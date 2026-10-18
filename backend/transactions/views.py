import logging
import uuid
from decimal import Decimal
from django.db.models import Q

logger = logging.getLogger(__name__)
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from providers.adapter import ProviderAdapter, VerificationResult
from providers.client import NewdatasubClient
from providers.exceptions import ProviderFailedException, ProviderTimeoutException
from providers.router import ProviderRouter
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from common.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from products.models import Product, ProductCategory
from wallets.models import WalletConfig
from wallets.services import WalletService
from .mixins import VendingResponseMixin
from .models import Transaction, AdminAuditLog
from .serializers import (
    BuyAirtimeRequestSerializer,
    BuyDataRequestSerializer,
    BuyElectricitySerializer,
    BuyCableSerializer,
    BuyBroadbandSerializer,
    BuyEducationSerializer,
    VerifyMeterSerializer,
    VerifySmartcardSerializer,
    VerifyBroadbandSerializer,
    TransactionDetailSerializer,
    TransactionSerializer,
    VendRequestSerializer,
)
from .strategy import InsufficientFundsError, VendingStrategy
from .services import TransactionService


class VendingThrottle(UserRateThrottle):
    # Own scope so vending requests get a separate counter from the global user throttle.
    # Rate is read from settings DEFAULT_THROTTLE_RATES["vending"].
    scope = "vending"


def _normalize_nigerian_phone(phone: str) -> str:
    """
    Normalize Nigerian phone numbers to the local 11-digit format (e.g. 08012345678).
    Handles: +2348012345678, 2348012345678, 08012345678, 8012345678
    """
    phone = phone.strip().replace(" ", "").replace("-", "")
    if phone.startswith("+234"):
        phone = "0" + phone[4:]
    elif phone.startswith("234") and len(phone) == 13:
        phone = "0" + phone[3:]
    elif len(phone) == 10 and not phone.startswith("0"):
        phone = "0" + phone
    return phone


def _provider_success_message(txn, fallback: str) -> str:
    raw = txn.provider_response or {}
    return raw.get("server_message") or raw.get("message") or fallback


def _apply_purchase_cashback(user, txn, product: Product, amount: Decimal) -> Decimal:
    """Apply cashback for a purchase. Delegates to TransactionService for consistency."""
    return TransactionService.apply_purchase_cashback(txn)


class VendAPIView(VendingResponseMixin, APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [VendingThrottle]

    @extend_schema(
        request=VendRequestSerializer, responses={200: TransactionSerializer, 400: dict}
    )
    def post(self, request):
        """
        Initiate a vending transaction (e.g. buy airtime, data, electricity).
        Requires the `Idempotency-Key` header.
        """
        serializer = VendRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        client = NewdatasubClient()
        adapter = ProviderAdapter(client)
        strategy = VendingStrategy(adapter)

        try:
            txn = strategy.process_vend(
                user=request.user,
                amount=float(data["amount"]),
                vend_type=data["type"],
                target=data["target"],
                provider_payload=data.get("provider_payload"),
            )
            return Response(TransactionSerializer(txn).data, status=status.HTTP_200_OK)
        except Exception as exc:
            return self.handle_vending_exceptions(exc)


class TransactionListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: TransactionSerializer(many=True)})
    def get(self, request):
        """List user's transactions with filtering and pagination."""
        queryset = Transaction.objects.select_related("product").filter(user=request.user).order_by("-created_at")

        txn_type = request.query_params.get("type")
        txn_status = request.query_params.get("status")
        search = request.query_params.get("search")

        if txn_type:
            queryset = queryset.filter(type=txn_type.upper())
        if txn_status:
            queryset = queryset.filter(status=txn_status.upper())
        if search:
            queryset = queryset.filter(
                Q(target__icontains=search)
                | Q(type__icontains=search)
                | Q(provider_reference__icontains=search)
            )

        paginator = PageNumberPagination()
        page_size = int(request.query_params.get("page_size", 20))
        paginator.page_size = max(1, min(page_size, 100))
        page = paginator.paginate_queryset(queryset, request)
        serializer = TransactionSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class AdminTransactionListAPIView(APIView):
    """List all transactions (admin only). Supports filtering and pagination."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(responses={200: TransactionSerializer(many=True)})
    def get(self, request):
        queryset = Transaction.objects.select_related("user", "product").order_by("-created_at")

        txn_type = request.query_params.get("type")
        txn_status = request.query_params.get("status")
        search = request.query_params.get("search")
        user_id = request.query_params.get("user_id")
        refunded = request.query_params.get("refunded")

        if txn_type:
            queryset = queryset.filter(type=txn_type.upper())
        if txn_status:
            queryset = queryset.filter(status=txn_status.upper())
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if refunded in {"true", "false"}:
            queryset = queryset.filter(is_refunded=(refunded == "true"))
        if search:
            queryset = queryset.filter(
                Q(target__icontains=search)
                | Q(type__icontains=search)
                | Q(provider_reference__icontains=search)
                | Q(user__username__icontains=search)
                | Q(user__email__icontains=search)
            )

        paginator = PageNumberPagination()
        page_size = int(request.query_params.get("page_size", 20))
        paginator.page_size = max(1, min(page_size, 200))
        page = paginator.paginate_queryset(queryset, request)
        serializer = TransactionDetailSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class TransactionDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TransactionDetailSerializer

    @extend_schema(responses={200: TransactionDetailSerializer, 404: OpenApiTypes.OBJECT})
    def get(self, request, pk):
        txn = Transaction.objects.filter(pk=pk, user=request.user).first()
        if not txn:
            return Response(
                {"error": "Transaction not found."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(TransactionDetailSerializer(txn).data)


class AdminTransactionDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = TransactionDetailSerializer

    @extend_schema(responses={200: TransactionDetailSerializer, 404: OpenApiTypes.OBJECT})
    def get(self, request, pk):
        txn = Transaction.objects.select_related("user").filter(pk=pk).first()
        if not txn:
            return Response(
                {"error": "Transaction not found."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(TransactionDetailSerializer(txn).data)


class AdminTransactionRefundAPIView(APIView):
    """Manual refund endpoint for admins."""

    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = TransactionDetailSerializer

    @extend_schema(responses={200: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT})
    def post(self, request, pk):
        txn = Transaction.objects.select_related("user").filter(pk=pk).first()
        if not txn:
            return Response({"error": "Transaction not found."}, status=status.HTTP_404_NOT_FOUND)
        if txn.status != "FAILED":
            return Response(
                {"error": "Manual refunds are only allowed for FAILED transactions."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if txn.is_refunded:
            return Response(
                {"error": "Transaction already refunded.", "refund_reference": txn.refund_reference},
                status=status.HTTP_400_BAD_REQUEST,
            )
        TransactionService.refund_transaction(txn)
        txn.refresh_from_db()
        return Response(
            {
                "success": True,
                "message": "Refund processed.",
                "transaction_id": txn.id,
                "refund_reference": txn.refund_reference,
            }
        )


class ProviderBalanceAPIView(APIView):
    """
    Staff/admin-gated provider balance endpoint.
    Returns the provider raw response for operational visibility.
    """

    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = TransactionSerializer

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        client = NewdatasubClient()
        try:
            raw = client.make_request({"action": "balance"})
            if not bool(raw.get("status")):
                raw = client.make_request({"action": "wallet_balance"})
            return Response({"success": True, "provider_response": raw})
        except Exception as exc:
            logger.exception("Provider balance check failed")
            return Response(
                {"success": False, "message": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )


def _get_client_and_strategy():
    client = NewdatasubClient()
    adapter = ProviderAdapter(client)
    return VendingStrategy(adapter)


class BuyAirtimeView(VendingResponseMixin, APIView):
    """
    Product-based airtime purchase. Provide product_id, or network + amount to resolve product.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [VendingThrottle]

    @extend_schema(
        request=BuyAirtimeRequestSerializer,
        responses={200: TransactionSerializer, 400: dict, 404: dict},
    )
    def post(self, request):
        serializer = BuyAirtimeRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        product = None
        if data.get("product_id"):
            product = Product.objects.filter(
                id=data["product_id"],
                category=ProductCategory.AIRTIME,
                is_active=True,
            ).first()
        elif data.get("network"):
            product = Product.objects.filter(
                network=data["network"],
                category=ProductCategory.AIRTIME,
                is_active=True,
            ).first()
        if not product or not product.provider_product_code:
            return Response(
                {"error": "PRODUCT_NOT_FOUND", "message": "No airtime product found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        amount = float(data["amount"])
        phone = _normalize_nigerian_phone(data["phone"])
        use_cashback = data.get("use_cashback", False)
        user_reference = f"NDS_{uuid.uuid4().hex[:12].upper()}"
        provider_payload = ProviderRouter.build_airtime_payload(product, phone, amount, user_reference)
        strategy = ProviderRouter.get_strategy(product.provider)

        if use_cashback:
            wallet = WalletService.get_or_create_wallet(request.user)
            if wallet.cashback_balance < Decimal(str(amount)):
                return Response(
                    {
                        "error": "INSUFFICIENT_CASHBACK",
                        "message": f"Insufficient cashback balance. Available: ₦{wallet.cashback_balance}",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            txn = strategy.process_vend(
                user=request.user,
                amount=amount,
                vend_type="AIRTIME",
                target=phone,
                provider_payload=provider_payload,
                funding_source="CASHBACK" if use_cashback else "WALLET",
            )
            # Cashback-funded purchases don't earn further cashback.
            cashback_amount = (
                Decimal("0.00")
                if use_cashback
                else _apply_purchase_cashback(request.user, txn, product, Decimal(str(amount)))
            )
            provider_message = _provider_success_message(txn, "Airtime purchase successful")
            return Response(
                {
                    "success": True,
                    "data": {
                        "transaction": TransactionSerializer(txn).data,
                        "message": provider_message,
                        "cashback_amount": str(cashback_amount),
                    },
                },
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            return self.handle_vending_exceptions(exc)


class BuyDataView(VendingResponseMixin, APIView):
    """Product-based data plan purchase. Requires product_id."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [VendingThrottle]

    @extend_schema(
        request=BuyDataRequestSerializer,
        responses={200: TransactionSerializer, 400: dict, 404: dict},
    )
    def post(self, request):
        serializer = BuyDataRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        product = Product.objects.filter(
            id=data["product_id"],
            category=ProductCategory.DATA,
            is_active=True,
        ).first()
        if not product or not product.provider_product_code:
            return Response(
                {"error": "PRODUCT_NOT_FOUND", "message": "Data product not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        amount = float(product.selling_price)
        phone = _normalize_nigerian_phone(data["phone"])
        user_reference = f"NDS_{uuid.uuid4().hex[:12].upper()}"
        provider_payload = ProviderRouter.build_data_payload(product, phone, user_reference)
        strategy = ProviderRouter.get_strategy(product.provider)

        try:
            txn = strategy.process_vend(
                user=request.user,
                amount=amount,
                vend_type="DATA",
                target=phone,
                provider_payload=provider_payload,
            )
            cashback_amount = _apply_purchase_cashback(
                request.user, txn, product, Decimal(str(amount))
            )
            provider_message = _provider_success_message(txn, "Data purchase successful")
            return Response(
                {
                    "success": True,
                    "data": {
                        "transaction": TransactionSerializer(txn).data,
                        "message": provider_message,
                        "cashback_amount": str(cashback_amount),
                    },
                },
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            return self.handle_vending_exceptions(exc)


class VerifyMeterView(APIView):
    """Verify electricity meter details before purchase."""
    permission_classes = [IsAuthenticated]

    @extend_schema(request=VerifyMeterSerializer, responses={200: dict})
    def post(self, request):
        serializer = VerifyMeterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        client = NewdatasubClient()
        adapter = ProviderAdapter(client)
        payload = {
            "action": "verify",
            "meter_number": data["meter_number"],
            "meter_type": data["meter_type"],
            "disco_code": data["disco_code"],
        }
        try:
            result = adapter.execute_verify(payload)
            return Response({
                "success": True,
                "data": {
                    "customer_name": result.customer_name or "",
                    "meter_number": data["meter_number"],
                    "disco_code": data["disco_code"],
                    "raw": result.raw.get("data", {}) if result.raw else {},
                },
            })
        except Exception as exc:
            logger.exception("Meter verification failed | meter=%s disco=%s", data.get("meter_number"), data.get("disco_code"))
            return Response(
                {"success": False, "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class VerifySmartcardView(APIView):
    """Verify cable TV smartcard before purchase."""
    permission_classes = [IsAuthenticated]

    @extend_schema(request=VerifySmartcardSerializer, responses={200: dict})
    def post(self, request):
        serializer = VerifySmartcardSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        client = NewdatasubClient()
        adapter = ProviderAdapter(client)
        payload = {
            "action": "verify",
            "smartcard_number": data["smartcard_number"],
            "cable_provider": data["cable_provider"],
        }
        try:
            result = adapter.execute_verify(payload)
            return Response({
                "success": True,
                "data": {
                    "customer_name": result.customer_name or "",
                    "smartcard_number": data["smartcard_number"],
                    "raw": result.raw.get("data", {}) if result.raw else {},
                },
            })
        except Exception as exc:
            logger.exception("Smartcard verification failed | smartcard=%s", data.get("smartcard_number"))
            return Response(
                {"success": False, "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class VerifyBroadbandView(APIView):
    """Verify broadband account before purchase."""
    permission_classes = [IsAuthenticated]

    @extend_schema(request=VerifyBroadbandSerializer, responses={200: dict})
    def post(self, request):
        serializer = VerifyBroadbandSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        client = NewdatasubClient()
        adapter = ProviderAdapter(client)
        payload = {
            "action": "verify",
            "account_number": data["account_number"],
            "broadband_provider": data["broadband_provider"],
        }
        try:
            result = adapter.execute_verify(payload)
            return Response({
                "success": True,
                "data": {
                    "customer_name": result.customer_name or "",
                    "account_number": data["account_number"],
                    "raw": result.raw.get("data", {}) if result.raw else {},
                },
            })
        except Exception as exc:
            logger.exception("Broadband verification failed | account=%s provider=%s", data.get("account_number"), data.get("broadband_provider"))
            return Response(
                {"success": False, "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class BuyElectricityView(VendingResponseMixin, APIView):
    """Electricity token purchase."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [VendingThrottle]

    @extend_schema(
        request=BuyElectricitySerializer,
        responses={200: TransactionSerializer, 400: dict, 404: dict},
    )
    def post(self, request):
        serializer = BuyElectricitySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        product = Product.objects.filter(
            id=data["product_id"],
            category=ProductCategory.ELECTRICITY,
            is_active=True,
        ).first()
        if not product or not product.provider_product_code:
            return Response(
                {"error": "PRODUCT_NOT_FOUND", "message": "Electricity product not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        amount = float(data["amount"])
        meter_number = data["meter_number"].strip()
        user_reference = f"NDS_{uuid.uuid4().hex[:12].upper()}"
        provider_payload = ProviderRouter.build_electricity_payload(
            product, meter_number, data["meter_type"], amount, user_reference
        )
        strategy = ProviderRouter.get_strategy(product.provider)
        try:
            txn = strategy.process_vend(
                user=request.user,
                amount=amount,
                vend_type="ELECTRICITY",
                target=meter_number,
                provider_payload=provider_payload,
            )
            cashback_amount = _apply_purchase_cashback(
                request.user, txn, product, Decimal(str(amount))
            )
            txn_data = TransactionSerializer(txn).data
            raw = txn.provider_response or {}
            token_data = raw.get("data", {}) if isinstance(raw.get("data"), dict) else {}
            txn_data["token"] = token_data.get("token", "")
            provider_message = _provider_success_message(txn, "Electricity purchase successful")
            return Response(
                {
                    "success": True,
                    "data": {
                        "transaction": txn_data,
                        "message": provider_message,
                        "cashback_amount": str(cashback_amount),
                    },
                },
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            return self.handle_vending_exceptions(exc)


class BuyCableView(VendingResponseMixin, APIView):
    """Cable TV subscription purchase."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [VendingThrottle]

    @extend_schema(
        request=BuyCableSerializer,
        responses={200: TransactionSerializer, 400: dict, 404: dict},
    )
    def post(self, request):
        serializer = BuyCableSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        product = Product.objects.filter(
            id=data["product_id"],
            category=ProductCategory.CABLE,
            is_active=True,
        ).first()
        if not product or not product.provider_product_code:
            return Response(
                {"error": "PRODUCT_NOT_FOUND", "message": "Cable product not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        amount = float(product.selling_price)
        smartcard = data["smartcard_number"].strip()
        user_reference = f"NDS_{uuid.uuid4().hex[:12].upper()}"
        provider_payload = ProviderRouter.build_cable_payload(product, smartcard, user_reference)
        strategy = ProviderRouter.get_strategy(product.provider)
        try:
            txn = strategy.process_vend(
                user=request.user,
                amount=amount,
                vend_type="CABLE",
                target=smartcard,
                provider_payload=provider_payload,
            )
            cashback_amount = _apply_purchase_cashback(
                request.user, txn, product, Decimal(str(amount))
            )
            provider_message = _provider_success_message(txn, "Cable purchase successful")
            return Response(
                {
                    "success": True,
                    "data": {
                        "transaction": TransactionSerializer(txn).data,
                        "message": provider_message,
                        "cashback_amount": str(cashback_amount),
                    },
                },
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            return self.handle_vending_exceptions(exc)


class BuyBroadbandView(VendingResponseMixin, APIView):
    """Broadband subscription purchase."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [VendingThrottle]

    @extend_schema(
        request=BuyBroadbandSerializer,
        responses={200: TransactionSerializer, 400: dict, 404: dict},
    )
    def post(self, request):
        serializer = BuyBroadbandSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        product = Product.objects.filter(
            id=data["product_id"],
            category=ProductCategory.BROADBAND,
            is_active=True,
        ).first()
        if not product or not product.provider_product_code:
            return Response(
                {"error": "PRODUCT_NOT_FOUND", "message": "Broadband product not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        amount = float(product.selling_price)
        account = data["account_number"].strip()
        user_reference = f"NDS_{uuid.uuid4().hex[:12].upper()}"
        provider_payload = ProviderRouter.build_broadband_payload(product, account, user_reference)
        strategy = ProviderRouter.get_strategy(product.provider)
        try:
            txn = strategy.process_vend(
                user=request.user,
                amount=amount,
                vend_type="BROADBAND",
                target=account,
                provider_payload=provider_payload,
            )
            cashback_amount = _apply_purchase_cashback(
                request.user, txn, product, Decimal(str(amount))
            )
            provider_message = _provider_success_message(txn, "Broadband purchase successful")
            return Response(
                {
                    "success": True,
                    "data": {
                        "transaction": TransactionSerializer(txn).data,
                        "message": provider_message,
                        "cashback_amount": str(cashback_amount),
                    },
                },
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            return self.handle_vending_exceptions(exc)


class BuyEducationView(VendingResponseMixin, APIView):
    """Education PIN purchase (WAEC, NECO, etc.)."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [VendingThrottle]

    @extend_schema(
        request=BuyEducationSerializer,
        responses={200: TransactionSerializer, 400: dict, 404: dict},
    )
    def post(self, request):
        serializer = BuyEducationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        product = Product.objects.filter(
            id=data["product_id"],
            category=ProductCategory.EDUCATION,
            is_active=True,
        ).first()
        if not product or not product.provider_product_code:
            return Response(
                {"error": "PRODUCT_NOT_FOUND", "message": "Education product not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        quantity = data.get("quantity", 1)
        amount = float(product.selling_price) * quantity
        user_reference = f"NDS_{uuid.uuid4().hex[:12].upper()}"
        provider_payload = ProviderRouter.build_education_payload(product, quantity, user_reference)
        strategy = ProviderRouter.get_strategy(product.provider)
        try:
            txn = strategy.process_vend(
                user=request.user,
                amount=amount,
                vend_type="EDUCATION",
                target=f"education-{product.name}",
                provider_payload=provider_payload,
            )
            cashback_amount = _apply_purchase_cashback(
                request.user, txn, product, Decimal(str(amount))
            )
            txn_data = TransactionSerializer(txn).data
            raw = txn.provider_response or {}
            token_data = raw.get("data", {}) if isinstance(raw.get("data"), dict) else {}
            txn_data["token"] = token_data.get("token") or token_data.get("true_response", "")
            provider_message = _provider_success_message(txn, "Education purchase successful")
            return Response(
                {
                    "success": True,
                    "data": {
                        "transaction": txn_data,
                        "message": provider_message,
                        "cashback_amount": str(cashback_amount),
                    },
                },
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            return self.handle_vending_exceptions(exc)


class OrderStatusView(APIView):
    """
    Check status of a previous order.

    If the transaction is still PENDING, this will poll the provider for the
    latest status and update the local record accordingly (mirrors DBN's
    ``check_order_status`` which hits the Newdatasub status API).
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: TransactionDetailSerializer, 404: dict})
    def get(self, request, pk):
        txn = Transaction.objects.filter(pk=pk, user=request.user).first()
        if not txn:
            return Response(
                {"error": "Transaction not found."}, status=status.HTTP_404_NOT_FOUND
            )

        # If still PENDING, try polling the provider for an update
        if txn.status == TransactionStatus.PENDING and txn.provider_reference:
            try:
                self._poll_provider_status(txn)
            except Exception:
                logger.debug("Provider status poll failed for txn %s (non-fatal)", txn.id)

        return Response({
            "success": True,
            "data": {"transaction": TransactionDetailSerializer(txn).data},
        })

    def _poll_provider_status(self, txn: Transaction) -> None:
        """Poll the provider for the latest order status and update the DB."""
        from providers.client import NewdatasubClient
        from providers.adapter import ProviderAdapter

        client = NewdatasubClient()
        adapter = ProviderAdapter(client)

        # Extract the provider's recharge_id from the raw response or reference
        recharge_id = None
        raw = txn.provider_response or {}
        data = raw.get("data", {})
        if isinstance(data, dict):
            recharge_id = data.get("recharge_id")
        if not recharge_id and txn.provider_reference:
            # Try parsing the reference as a numeric ID
            try:
                recharge_id = int(txn.provider_reference.split("-")[-1])
            except (ValueError, IndexError):
                pass

        if not recharge_id:
            return

        try:
            result = client.make_request({"action": "status", "order_id": recharge_id})
        except Exception:
            return

        status_str = str(result.get("text_status", "")).upper()
        if status_str == "COMPLETED":
            provider_ref = None
            result_data = result.get("data", {})
            if isinstance(result_data, dict):
                provider_ref = str(result_data.get("recharge_id", ""))
            TransactionService.mark_transaction_success(txn, reference=provider_ref)
        elif status_str in ("FAILED", "REJECTED", "ERROR"):
            TransactionService.mark_transaction_failed(
                txn,
                error_code="PROVIDER_FAILED",
                error_message=result.get("server_message") or "Order failed at provider",
            )
            # Refund on failure
            try:
                TransactionService.refund_transaction(txn)
            except Exception:
                logger.exception("Auto-refund failed for txn %s", txn.id)


class AvailableServicesView(APIView):
    """List available service categories based on active products."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: dict})
    def get(self, request):
        active_categories = (
            Product.objects.filter(is_active=True)
            .values_list("category", flat=True)
            .distinct()
        )
        services = []
        category_labels = dict(ProductCategory.choices)
        for cat in active_categories:
            services.append({
                "key": cat,
                "label": category_labels.get(cat, cat),
            })
        return Response({"success": True, "data": {"services": services}})


class AdminTransactionResolveView(APIView):
    """
    Manually resolve a PENDING transaction or override any transaction status.
    Actions:
      - 'success': mark SUCCESS (no refund)
      - 'fail': mark FAILED and refund wallet
      - 'refund': refund a FAILED transaction (same as existing refund endpoint but logs)
    Requires a note explaining the manual intervention.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, pk):
        action = str(request.data.get("action", "")).lower()
        note = str(request.data.get("note", "")).strip()
        provider_reference = str(request.data.get("provider_reference", "")).strip() or None

        if action not in ("success", "fail", "refund"):
            return Response(
                {"error": "action must be one of: success, fail, refund"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not note:
            return Response({"error": "A note is required for manual resolution."}, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction as db_transaction

        with db_transaction.atomic():
            # Lock the row so two concurrent admin actions on the same transaction
            # can't interleave (e.g. one marks SUCCESS while another marks FAILED+refund).
            txn = Transaction.objects.select_related("user").select_for_update().filter(pk=pk).first()
            if not txn:
                return Response({"error": "Transaction not found."}, status=status.HTTP_404_NOT_FOUND)

            prev_status = txn.status

            if action == "success":
                if txn.status == "SUCCESS":
                    return Response({"error": "Transaction is already SUCCESS."}, status=status.HTTP_400_BAD_REQUEST)
                txn.status = "SUCCESS"
                if provider_reference:
                    txn.provider_reference = provider_reference
                txn.provider_response = {
                    **(txn.provider_response or {}),
                    "admin_resolved": True,
                    "admin_note": note,
                    "resolved_by": request.user.username,
                }
                txn.save()

            elif action == "fail":
                if txn.status == "FAILED":
                    return Response({"error": "Transaction is already FAILED."}, status=status.HTTP_400_BAD_REQUEST)
                was_pending = txn.status == "PENDING"
                txn.status = "FAILED"
                txn.provider_response = {
                    **(txn.provider_response or {}),
                    "admin_resolved": True,
                    "admin_note": note,
                    "resolved_by": request.user.username,
                }
                txn.save()
                # Refund inside the same atomic block so a crash can't leave the
                # transaction FAILED without the wallet credit having landed.
                if was_pending and not txn.is_refunded:
                    TransactionService.refund_transaction(txn)

            elif action == "refund":
                if txn.status != "FAILED":
                    return Response({"error": "Refund is only allowed on FAILED transactions."}, status=status.HTTP_400_BAD_REQUEST)
                if txn.is_refunded:
                    return Response({"error": "Already refunded.", "refund_reference": txn.refund_reference}, status=status.HTTP_400_BAD_REQUEST)
                TransactionService.refund_transaction(txn)

        txn.refresh_from_db()
        AdminAuditLog.objects.create(
            admin=request.user,
            action=f"RESOLVE_{action.upper()}",
            transaction=txn,
            target_user=txn.user,
            note=note,
            metadata={"prev_status": prev_status, "new_status": txn.status},
        )

        return Response({
            "success": True,
            "message": f"Transaction {txn.id} resolved as {action.upper()}.",
            "transaction_id": txn.id,
            "status": txn.status,
            "is_refunded": txn.is_refunded,
            "refund_reference": txn.refund_reference,
        })


class AdminBulkRefundView(APIView):
    """
    Bulk refund multiple FAILED, non-refunded transactions in one request.
    Accepts: { "transaction_ids": [1, 2, 3], "note": "Provider outage 2024-04-26" }
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        ids = request.data.get("transaction_ids", [])
        note = str(request.data.get("note", "")).strip()

        if not isinstance(ids, list) or not ids:
            return Response({"error": "transaction_ids must be a non-empty list."}, status=status.HTTP_400_BAD_REQUEST)
        if not note:
            return Response({"error": "A note is required for bulk refund."}, status=status.HTTP_400_BAD_REQUEST)
        if len(ids) > 200:
            return Response({"error": "Maximum 200 transactions per bulk refund."}, status=status.HTTP_400_BAD_REQUEST)

        txns = Transaction.objects.select_related("user").filter(
            id__in=ids, status="FAILED", is_refunded=False
        )

        refunded = []
        skipped = []
        errors = []

        for txn in txns:
            try:
                TransactionService.refund_transaction(txn)
                AdminAuditLog.objects.create(
                    admin=request.user,
                    action="BULK_REFUND",
                    transaction=txn,
                    target_user=txn.user,
                    note=note,
                    metadata={"amount": str(txn.amount)},
                )
                refunded.append(txn.id)
            except Exception as exc:
                errors.append({"id": txn.id, "error": str(exc)})

        requested_ids = set(int(i) for i in ids)
        found_ids = set(t.id for t in txns)
        skipped = list(requested_ids - found_ids)

        return Response({
            "success": True,
            "refunded_count": len(refunded),
            "refunded_ids": refunded,
            "skipped_ids": skipped,
            "errors": errors,
        })


class AdminAuditLogListView(APIView):
    """List admin audit log entries, newest first. Supports filter by action, admin, transaction."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        qs = AdminAuditLog.objects.select_related("admin", "transaction", "target_user").order_by("-created_at")

        action = request.query_params.get("action")
        txn_id = request.query_params.get("transaction_id")
        admin_id = request.query_params.get("admin_id")
        target_user_id = request.query_params.get("target_user_id")

        if action:
            qs = qs.filter(action__icontains=action)
        if txn_id:
            qs = qs.filter(transaction_id=txn_id)
        if admin_id:
            qs = qs.filter(admin_id=admin_id)
        if target_user_id:
            qs = qs.filter(target_user_id=target_user_id)

        paginator = PageNumberPagination()
        paginator.page_size = int(request.query_params.get("page_size", 50))
        paginator.page_size = max(1, min(paginator.page_size, 200))
        page = paginator.paginate_queryset(qs, request)

        data = [
            {
                "id": log.id,
                "admin": log.admin.username if log.admin else None,
                "action": log.action,
                "transaction_id": log.transaction_id,
                "target_user": log.target_user.username if log.target_user else None,
                "note": log.note,
                "metadata": log.metadata,
                "created_at": log.created_at.isoformat(),
            }
            for log in page
        ]
        return paginator.get_paginated_response(data)
