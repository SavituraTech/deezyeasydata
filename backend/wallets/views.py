import logging
from decimal import Decimal
from drf_spectacular.types import OpenApiTypes
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from common.permissions import IsAdminUser
from drf_spectacular.utils import extend_schema

from django.conf import settings

import random

from .models import Wallet, VirtualAccount, WalletConfig
from .services import WalletService
from .serializers import WalletSerializer, LedgerSerializer, VirtualAccountSerializer, WalletConfigSerializer
from integrations.payments.serializers import InitiateDepositSerializer
from transactions.services import TransactionService
from common.exceptions import PaymentGatewayException

logger = logging.getLogger(__name__)


class InitiateDepositView(APIView):
    """
    Initiate a wallet deposit. Creates a PENDING deposit transaction.
    When PayVessel is configured, calls the gateway and returns authorization_url
    for redirect; otherwise returns payment_reference for client-side integration.
    Webhook completes the deposit when payment is confirmed.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = InitiateDepositSerializer

    @extend_schema(
        request=InitiateDepositSerializer,
        responses={200: OpenApiTypes.OBJECT},
    )
    def post(self, request):
        from transactions.services import _generate_payment_reference
        from integrations.payments.client import get_client, PayVesselClient

        serializer = InitiateDepositSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "error": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        amount = serializer.validated_data["amount"]
        callback_url = serializer.validated_data.get("callback_url") or ""
        provider = "payvessel"
        config = WalletConfig.get_solo()
        selected_provider = (provider or config.default_payment_provider).lower()
        if not getattr(config, f"{selected_provider}_enabled", False):
            return Response(
                {"success": False, "error": {"code": "PROVIDER_DISABLED", "message": "This payment provider is currently unavailable."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        provider = selected_provider

        payment_reference = _generate_payment_reference()
        txn = TransactionService.create_deposit_transaction(
            request.user, amount, payment_reference
        )

        # If a payment gateway is configured, initiate payment and return redirect URL
        client = get_client(provider)
        if client.is_configured():
            try:
                payment_result = client.initiate_payment(
                    amount=float(amount),
                    email=request.user.email or request.user.username or "",
                    reference=payment_reference,
                    callback_url=callback_url or None,
                    metadata={
                        "user_id": request.user.id,
                        "transaction_id": txn.id,
                        "provider": (
                            "payvessel" if isinstance(client, PayVesselClient) else "paymentpoint"
                        ),
                    },
                )
                if payment_result.success:
                    if payment_result.payment_reference and payment_result.payment_reference != payment_reference:
                        txn.provider_reference = payment_result.payment_reference
                        txn.save(update_fields=["provider_reference"])
                    return Response(
                        {
                            "success": True,
                            "data": {
                                "payment_reference": payment_reference,
                                "amount": str(amount),
                                "status": "pending",
                                "transaction_id": txn.id,
                                "payment": {
                                    "reference": payment_result.payment_reference,
                                    "authorization_url": payment_result.authorization_url or payment_result.payment_url,
                                    "message": payment_result.message,
                                },
                                "message": "Redirect user to authorization_url to complete payment.",
                            },
                        },
                        status=status.HTTP_200_OK,
                    )
                # Initiation failed: leave txn PENDING; client can still poll or use other flow
                logger.warning(
                    "PayVessel initiation failed for txn %s: %s",
                    txn.id,
                    payment_result.message,
                )
                TransactionService.mark_transaction_failed(
                    txn,
                    error_code="PAYMENT_INIT_ERROR",
                    error_message=payment_result.message or "Failed to initiate payment",
                )
                return Response(
                    {
                        "success": False,
                        "error": {
                            "code": "PAYMENT_INIT_ERROR",
                            "message": payment_result.message or "Failed to initiate payment",
                        },
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            except Exception as e:
                logger.exception("PayVessel initiation error for txn %s", txn.id)
                TransactionService.mark_transaction_failed(
                    txn,
                    error_code="PAYMENT_GATEWAY_ERROR",
                    error_message=str(e),
                )
                return Response(
                    {
                        "success": False,
                        "error": {
                            "code": "PAYMENT_GATEWAY_ERROR",
                            "message": "Failed to initiate payment. Please try again.",
                        },
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        # No gateway configured: return reference only (e.g. for manual or other provider)
        return Response(
            {
                "success": True,
                "data": {
                    "payment_reference": payment_reference,
                    "amount": str(amount),
                    "status": "pending",
                    "transaction_id": txn.id,
                    "message": "Complete payment using your provider. Wallet will be credited when payment is confirmed.",
                },
            },
            status=status.HTTP_200_OK,
        )


class WalletDetailView(APIView):
    """Get current user's wallet details."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=WalletSerializer)
    def get(self, request):
        wallet = WalletService.get_or_create_wallet(request.user)
        serializer = WalletSerializer(wallet)
        return Response(serializer.data)


class WalletLedgerView(APIView):
    """Get current user's wallet ledger/history."""

    permission_classes = [IsAuthenticated]
    serializer_class = LedgerSerializer

    @extend_schema(responses={200: LedgerSerializer(many=True)})
    def get(self, request):
        limit = int(request.query_params.get("limit", 50))
        offset = int(request.query_params.get("offset", 0))

        ledgers = WalletService.get_ledger_history(
            request.user, limit=limit, offset=offset
        )
        serializer = LedgerSerializer(ledgers, many=True)
        return Response(serializer.data)


class VirtualAccountView(APIView):
    """Get or create user's active virtual account."""

    permission_classes = [IsAuthenticated]
    serializer_class = VirtualAccountSerializer

    @extend_schema(responses={200: VirtualAccountSerializer, 404: OpenApiTypes.OBJECT})
    def get(self, request):
        if request.query_params.get("all", "").lower() in ("1", "true", "yes"):
            accounts = VirtualAccount.objects.filter(
                user=request.user, is_active=True
            ).order_by("-created_at")
            return Response(VirtualAccountSerializer(accounts, many=True).data)

        account = (
            VirtualAccount.objects.filter(user=request.user, is_active=True)
            .order_by("-created_at")
            .first()
        )
        if not account:
            return Response(None, status=status.HTTP_200_OK)
        return Response(VirtualAccountSerializer(account).data)

    @extend_schema(responses={200: VirtualAccountSerializer, 502: OpenApiTypes.OBJECT})
    def post(self, request):
        """
        Get or create a provider-backed virtual account for the current user.

        If an active account already exists for the provider, it is returned.
        Otherwise this will call the provider's reserved-account endpoint via
        ``WalletService`` using Deezy Easy Data's PayVessel integration.
        """
        provider = "PAYVESSEL"
        force_new = (
            str(request.data.get("force_new", "")).lower() in ("1", "true", "yes")
            if isinstance(request.data, dict)
            else False
        )
        try:
            account = WalletService.get_or_create_virtual_account(
                request.user, provider=provider, force_new=force_new
            )
        except PaymentGatewayException as exc:
            logger.warning("Virtual account creation failed: %s", exc.detail)
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "VIRTUAL_ACCOUNT_ERROR",
                        "message": str(exc.detail),
                    },
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            VirtualAccountSerializer(account).data, status=status.HTTP_200_OK
        )


class PaymentProvidersView(APIView):
    """
    List payment providers available for wallet funding.

    Returns only providers whose gateway credentials are configured, so the
    frontend can offer users exactly the funding methods that actually work.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        from integrations.payments.client import get_client

        providers = [
            {
                "id": "payvessel",
                "name": "PayVessel",
                "description": "Card & bank transfer",
            },
        ]

        available = []
        config = WalletConfig.get_solo()
        for p in providers:
            if not getattr(config, f"{p['id']}_enabled", False):
                continue
            client = get_client(p["id"])
            if client.is_configured():
                available.append({**p, "available": True})
            elif getattr(settings, "DEBUG", False):
                # In DEBUG show all providers so the UI can be tested locally.
                available.append({**p, "available": False})

        default_provider = "payvessel"

        return Response(
            {
                "success": True,
                "default_provider": default_provider,
                "providers": available,
            },
            status=status.HTTP_200_OK,
        )


class WalletConfigView(APIView):
    """
    Public wallet config endpoint for authenticated users.
    Used by frontend to display current funding charge dynamically.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = WalletConfigSerializer

    @extend_schema(responses={200: WalletConfigSerializer})
    def get(self, request):
        config = WalletConfig.get_solo()
        return Response(WalletConfigSerializer(config).data)


class AdminWalletTransactionView(APIView):
    """
    Admin endpoint to manually credit or debit a user's wallet.
    Required fields: user_id (int), action ('credit'|'debit'), amount (decimal), description (str).
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()

        user_id = request.data.get("user_id")
        action = str(request.data.get("action", "")).lower()
        raw_amount = request.data.get("amount")
        description = str(request.data.get("description", "")).strip()

        if not user_id or action not in ("credit", "debit") or not raw_amount or not description:
            return Response(
                {"success": False, "error": "user_id, action (credit/debit), amount, and description are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            amount = Decimal(str(raw_amount))
            if amount <= 0:
                raise ValueError
        except (ValueError, Exception):
            return Response(
                {"success": False, "error": "Amount must be a positive number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"success": False, "error": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        wallet = WalletService.get_or_create_wallet(target_user)

        if action == "credit":
            WalletService.credit_wallet(
                wallet, amount,
                description=f"[Admin credit] {description}",
                related_transaction=None,
            )
        else:
            try:
                WalletService.debit_wallet(
                    wallet, amount,
                    description=f"[Admin debit] {description}",
                    related_transaction=None,
                )
            except Exception as e:
                return Response(
                    {"success": False, "error": str(e)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        wallet.refresh_from_db()
        return Response(
            {
                "success": True,
                "action": action,
                "amount": str(amount),
                "new_balance": str(wallet.balance),
                "message": f"Wallet {action}ed successfully.",
            },
            status=status.HTTP_200_OK,
        )


class AdminWalletConfigView(APIView):
    """
    Admin wallet config endpoint.
    Allows admins to view and update funding charge shown across wallet funding UI.
    """

    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = WalletConfigSerializer

    @extend_schema(
        responses={200: WalletConfigSerializer},
    )
    def get(self, request):
        config = WalletConfig.get_solo()
        return Response(WalletConfigSerializer(config).data, status=status.HTTP_200_OK)

    @extend_schema(
        request=WalletConfigSerializer,
        responses={200: WalletConfigSerializer},
    )
    def patch(self, request):
        config = WalletConfig.get_solo()
        serializer = WalletConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
