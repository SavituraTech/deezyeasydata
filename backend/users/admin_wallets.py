import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from common.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from common.exceptions import PaymentGatewayException
from drf_spectacular.types import OpenApiTypes

from wallets import admin_adjustments
from wallets.models import AdminWalletAdjustment, PlatformKYC, VirtualAccount
from wallets.serializers import (
    AdminWalletOperationSerializer,
    PlatformKYCSerializer,
    VirtualAccountSerializer,
)
from wallets.services import WalletService

User = get_user_model()


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return (forwarded.split(",")[-1].strip() if forwarded else request.META.get("REMOTE_ADDR")) or None


def _adjustment_payload(adj, replayed=False):
    pending = adj.status == AdminWalletAdjustment.Status.PENDING_APPROVAL
    return {
        "message": (
            "Adjustment submitted and awaiting approval by another admin."
            if pending
            else "Adjustment already processed." if replayed else "Adjustment applied."
        ),
        "id": adj.id,
        "user": adj.user_id,
        "type": adj.adjustment_type,
        "source": adj.source,
        "amount": str(adj.amount),
        "reason": adj.reason,
        "status": adj.status,
        "reference": adj.ledger.reference if adj.ledger_id else None,
        "balance_before": str(adj.balance_before) if adj.balance_before is not None else None,
        "balance_after": str(adj.balance_after) if adj.balance_after is not None else None,
        "idempotency_key": adj.idempotency_key,
        "replayed": replayed,
        "created_at": adj.created_at,
    }


class _AdminAdjustmentMixin:
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = AdminWalletOperationSerializer
    forced_type = None

    def _handle(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        data = dict(request.data.items()) if hasattr(request.data, "items") else {}
        if self.forced_type:
            data["type"] = self.forced_type
            data.pop("action", None)
        serializer = AdminWalletOperationSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        v = serializer.validated_data

        key = (
            v.get("idempotency_key")
            or request.headers.get("Idempotency-Key")
            or uuid.uuid4().hex
        )[:64]
        adj, replayed = admin_adjustments.adjust(
            admin=request.user,
            user=user,
            adjustment_type=v["type"],
            amount=v["amount"],
            reason=v["reason"],
            source=v["source"],
            idempotency_key=key,
            ip_address=_client_ip(request),
        )
        pending = adj.status == AdminWalletAdjustment.Status.PENDING_APPROVAL
        return Response(
            _adjustment_payload(adj, replayed),
            status=status.HTTP_202_ACCEPTED if pending else status.HTTP_200_OK,
        )


class FundUserWalletView(_AdminAdjustmentMixin, APIView):
    """Credit a user's wallet (admin only). Same safeguards as wallet-transaction."""

    forced_type = "CREDIT"

    @extend_schema(request=AdminWalletOperationSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request, pk):
        return self._handle(request, pk)


class UserWalletTransactionView(_AdminAdjustmentMixin, APIView):
    """
    Manual wallet credit/debit for a user.

    Body: ``type`` (CREDIT|DEBIT; ``action`` accepted), ``amount``, ``reason``
    (required; ``description`` accepted), optional ``source`` (WALLET|CASHBACK)
    and ``idempotency_key`` (or an ``Idempotency-Key`` header). Adjustments at or
    above ADMIN_ADJUSTMENT_APPROVAL_THRESHOLD return 202 and need another admin's approval.
    """

    @extend_schema(request=AdminWalletOperationSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request, pk):
        return self._handle(request, pk)


class WalletAdjustmentListView(APIView):
    """
    Paginated audit list of admin wallet adjustments.

    Filters: ``status``, ``user_id``, ``page``, ``page_size``. Each row has
    ``can_approve`` (pending and requested by someone else). The response also
    carries ``pending_count`` for badges.
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        qs = AdminWalletAdjustment.objects.select_related("ledger", "admin", "user", "approved_by")
        if request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"].upper())
        if request.query_params.get("user_id"):
            qs = qs.filter(user_id=request.query_params["user_id"])

        try:
            page = max(int(request.query_params.get("page", 1)), 1)
            page_size = min(max(int(request.query_params.get("page_size", 20)), 1), 100)
        except ValueError:
            page, page_size = 1, 20
        count = qs.count()
        start = (page - 1) * page_size

        rows = []
        for adj in qs[start:start + page_size]:
            row = _adjustment_payload(adj)
            pending = adj.status == AdminWalletAdjustment.Status.PENDING_APPROVAL
            row.update(
                admin=adj.admin_id,
                admin_username=adj.admin.username,
                user_username=adj.user.username,
                approved_by=adj.approved_by_id,
                approved_by_username=adj.approved_by.username if adj.approved_by_id else None,
                decided_at=adj.decided_at,
                ip_address=adj.ip_address,
                can_approve=pending and adj.admin_id != request.user.pk,
            )
            rows.append(row)
        return Response(
            {
                "count": count,
                "page": page,
                "pending_count": AdminWalletAdjustment.objects.filter(
                    status=AdminWalletAdjustment.Status.PENDING_APPROVAL
                ).count(),
                "results": rows,
            }
        )


class WalletAdjustmentDecisionView(APIView):
    """Approve or reject a pending adjustment (approver must differ from the requester)."""

    permission_classes = [IsAuthenticated, IsAdminUser]
    action = "approve"

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    def post(self, request, pk):
        if not AdminWalletAdjustment.objects.filter(pk=pk).exists():
            return Response({"error": "Adjustment not found"}, status=status.HTTP_404_NOT_FOUND)
        fn = admin_adjustments.approve if self.action == "approve" else admin_adjustments.reject
        adj = fn(pk, request.user)
        return Response(_adjustment_payload(adj))


class UserVirtualAccountsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = VirtualAccountSerializer

    @extend_schema(responses={200: VirtualAccountSerializer(many=True)})
    def get(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        rows = VirtualAccount.objects.filter(user=user).order_by("-created_at")
        return Response(VirtualAccountSerializer(rows, many=True).data)


class CreateUserVirtualAccountView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = VirtualAccountSerializer

    ALLOWED_PROVIDERS = {"PAYVESSEL"}

    @extend_schema(responses={200: VirtualAccountSerializer, 201: VirtualAccountSerializer})
    def post(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        requested_provider = (
            request.data.get("provider") if isinstance(request.data, dict) else None
        )
        if requested_provider and str(requested_provider).upper() not in self.ALLOWED_PROVIDERS:
            return Response(
                {
                    "error": {
                        "code": "INVALID_PROVIDER",
                        "message": f"Provider '{requested_provider}' is not supported.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        provider = "PAYVESSEL"

        try:
            # Real PayVessel-backed creation. Reuses an existing active account.
            va = WalletService.get_or_create_virtual_account(user, provider=provider)
            return Response(VirtualAccountSerializer(va).data, status=status.HTTP_200_OK)
        except PaymentGatewayException as exc:
            return Response(
                {"error": {"code": "VIRTUAL_ACCOUNT_ERROR", "message": str(exc.detail)}},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class PlatformKYCView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = PlatformKYCSerializer

    @extend_schema(
        request=PlatformKYCSerializer,
        responses={200: PlatformKYCSerializer},
    )
    def get(self, request):
        config = PlatformKYC.get_solo()
        return Response(PlatformKYCSerializer(config).data)

    @extend_schema(
        request=PlatformKYCSerializer,
        responses={200: PlatformKYCSerializer},
    )
    def put(self, request):
        config = PlatformKYC.get_solo()
        serializer = PlatformKYCSerializer(config, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)


class PlatformFeesView(APIView):
    """DBN-compatible platform fees endpoint (cashback + stamp duty)."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        from wallets.models import PlatformSettings
        cfg = PlatformSettings.get_config()
        return Response({"success": True, "data": {"default_purchase_cashback_percent": str(cfg.default_purchase_cashback_percent), "deposit_cashback_percent": str(cfg.deposit_cashback_percent), "stamp_duty_enabled": cfg.stamp_duty_enabled, "stamp_duty_amount": str(cfg.stamp_duty_amount)}})

    def put(self, request):
        from wallets.models import PlatformSettings
        from rest_framework import serializers as drf_serializers
        from decimal import Decimal

        class S(drf_serializers.Serializer):
            default_purchase_cashback_percent = drf_serializers.DecimalField(max_digits=5, decimal_places=2, required=False, min_value=Decimal("0.00"), max_value=Decimal("100.00"))
            deposit_cashback_percent = drf_serializers.DecimalField(max_digits=5, decimal_places=2, required=False, min_value=Decimal("0.00"), max_value=Decimal("100.00"))
            stamp_duty_enabled = drf_serializers.BooleanField(required=False)
            stamp_duty_amount = drf_serializers.DecimalField(max_digits=10, decimal_places=2, required=False, min_value=Decimal("0.00"))

        s = S(data=request.data, partial=True)
        if not s.is_valid():
            return Response({"success": False, "error": {"code": "VALIDATION_ERROR", "details": s.errors}}, status=status.HTTP_400_BAD_REQUEST)
        cfg = PlatformSettings.get_config()
        for k, v in s.validated_data.items():
            setattr(cfg, k, v)
        cfg.save()
        return Response({"success": True, "data": {"default_purchase_cashback_percent": str(cfg.default_purchase_cashback_percent), "deposit_cashback_percent": str(cfg.deposit_cashback_percent), "stamp_duty_enabled": cfg.stamp_duty_enabled, "stamp_duty_amount": str(cfg.stamp_duty_amount)}})
