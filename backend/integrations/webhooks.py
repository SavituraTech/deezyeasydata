"""
Webhook endpoints for payment providers.
Supports: PaymentPoint (signature + payload format), generic (event/reference/status).
"""

import hmac
import hashlib
from typing import Optional
import logging
from decimal import Decimal
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from django.conf import settings
from django.db import transaction as db_transaction
from rest_framework import status
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class PaymentWebhookPayloadSerializer(serializers.Serializer):
    pass


class PaymentWebhookView(APIView):
    """
    Single webhook for payment providers.

    - PaymentPoint: use header x-paymentpoint-signature or paymentpoint-signature;
      payload has transaction_status, notification_status, transaction_id, amount_paid, etc.
    - Generic: header X-Webhook-Signature (HMAC-SHA256 of body); payload has
      event, reference, status (SUCCESS/FAILED).
    """

    permission_classes = [AllowAny]
    serializer_class = PaymentWebhookPayloadSerializer

    def _looks_like_paymentpoint_payload(self, payload: dict) -> bool:
        """
        Detect PaymentPoint payloads by known field shape.

        Some providers may omit the expected signature header in test mode, so
        we also use payload keys to choose the right parser path.
        """
        if not isinstance(payload, dict):
            return False
        paymentpoint_keys = {
            "transaction_status",
            "notification_status",
            "transaction_id",
            "amount_paid",
            "receiver",
            "customer",
        }
        return any(k in payload for k in paymentpoint_keys)

    def _verify_generic_signature(self, request) -> bool:
        """Verify generic HMAC-SHA256 webhook signature."""
        signature = request.headers.get("X-Webhook-Signature")
        if not signature:
            return False
        secret = getattr(settings, "PAYMENT_WEBHOOK_SECRET", "")
        if not secret:
            logger.warning("No webhook secret configured")
            return False
        expected = hmac.new(
            secret.encode(), request.body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(signature, expected)

    @extend_schema(request=OpenApiTypes.OBJECT, responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        # PaymentPoint: signature in dedicated header
        pp_signature = (
            request.headers.get("x-paymentpoint-signature")
            or request.headers.get("paymentpoint-signature")
        )
        if pp_signature or self._looks_like_paymentpoint_payload(request.data):
            return self._handle_paymentpoint_webhook(request, pp_signature)

        # Generic format: verify and parse event/reference/status
        if not settings.DEBUG and not self._verify_generic_signature(request):
            logger.warning("Invalid webhook signature")
            return Response(
                {"error": "Invalid signature"}, status=status.HTTP_401_UNAUTHORIZED
            )
        try:
            payload = request.data
            event = payload.get("event", "")
            reference = payload.get("reference")
            status_val = payload.get("status", "")
            logger.info("Webhook received: %s - %s - %s", event, reference, status_val)
            if event.startswith("payment."):
                if status_val == "SUCCESS":
                    return self.handle_payment_success(reference, payload)
                if status_val == "FAILED":
                    return self.handle_payment_failed(reference, payload)
            return Response({"message": "Event received"}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception("Webhook processing error: %s", e)
            return Response(
                {"error": "Internal error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _handle_paymentpoint_webhook(self, request, signature: str | None):
        """Verify PaymentPoint signature, parse payload, complete or fail deposit."""
        from integrations.payments.client import handle_webhook
        from transactions.models import Transaction, TransactionType
        from transactions.services import TransactionService
        from wallets.models import VirtualAccount
        from common.exceptions import PaymentGatewayException

        try:
            webhook_result = handle_webhook(request.body, signature)
        except PaymentGatewayException as e:
            return Response(
                {"error": str(e.detail)}, status=status.HTTP_400_BAD_REQUEST
            )

        payment_reference = webhook_result.payment_reference
        if not payment_reference:
            return Response(
                {"error": "Missing payment reference in webhook"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        status_str = (webhook_result.status or "").strip().lower()
        success_statuses = {"paid", "success", "successful"}

        with db_transaction.atomic():
            existing = (
                Transaction.objects.select_for_update()
                .filter(
                    type=TransactionType.DEPOSIT,
                    provider_reference=payment_reference,
                    status="SUCCESS",
                )
                .first()
            )
            if existing:
                logger.info("Webhook already processed: %s", payment_reference)
                return Response(
                    {"success": True, "message": "Already processed"},
                    status=status.HTTP_200_OK,
                )

            txn = (
                Transaction.objects.select_for_update()
                .filter(
                    type=TransactionType.DEPOSIT,
                    provider_reference=payment_reference,
                    status="PENDING",
                )
                .first()
            )

            # If there is no pending deposit transaction, this may be a virtual
            # account credit. In that case we locate the virtual account by the
            # receiver account number from the webhook and create a new deposit
            # transaction for the associated user.
            if not txn:
                account_number = webhook_result.receiver_account_number
                if not account_number:
                    logger.warning(
                        "Transaction not found and no receiver account in webhook "
                        "for reference: %s",
                        payment_reference,
                    )
                    return Response(
                        {"error": "Transaction not found"},
                        status=status.HTTP_404_NOT_FOUND,
                    )

                va = (
                    VirtualAccount.objects.select_for_update()
                    .filter(
                        provider="PAYMENTPOINT",
                        account_number=account_number,
                        is_active=True,
                    )
                    .first()
                )
                if not va:
                    logger.warning(
                        "Virtual account not found for receiver account: %s",
                        account_number,
                    )
                    return Response(
                        {"error": "Virtual account not found for receiver"},
                        status=status.HTTP_404_NOT_FOUND,
                    )

                if webhook_result.amount is None:
                    logger.warning(
                        "Webhook missing amount for virtual account credit: %s",
                        payment_reference,
                    )
                    return Response(
                        {"error": "Amount not found in webhook"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                txn = TransactionService.create_deposit_transaction(
                    user=va.user,
                    amount=Decimal(str(webhook_result.amount)),
                    payment_reference=payment_reference,
                )

            if status_str in success_statuses:
                try:
                    TransactionService.complete_deposit_transaction(txn)
                    logger.info(
                        "Deposit completed via PaymentPoint webhook: txn %s", txn.id
                    )
                    return Response(
                        {"success": True, "message": "Deposit processed"},
                        status=status.HTTP_200_OK,
                    )
                except Exception as e:
                    logger.exception("Complete deposit failed: %s", e)
                    return Response(
                        {"error": str(e)},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )
            else:
                TransactionService.mark_transaction_failed(
                    txn,
                    error_code="PAYMENT_FAILED",
                    error_message=webhook_result.message or "Payment failed",
                )
                logger.info("Deposit failed via webhook: txn %s", txn.id)
                return Response(
                    {"success": True, "message": "Failure recorded"},
                    status=status.HTTP_200_OK,
                )

    def handle_payment_success(self, reference: str, payload: dict):
        """Handle successful payment: find DEPOSIT txn and credit wallet."""
        from transactions.models import Transaction, TransactionType
        from transactions.services import TransactionService

        try:
            txn = Transaction.objects.filter(
                type=TransactionType.DEPOSIT,
                provider_reference=reference,
                status="PENDING",
            ).first()

            if not txn:
                logger.warning(f"No deposit transaction found for reference: {reference}")
                return Response(
                    {"message": "Transaction not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            TransactionService.complete_deposit_transaction(txn)
            logger.info(f"Deposit completed for transaction {txn.id}")
            return Response({"message": "Payment processed"}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception(f"Error processing payment success: {e}")
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def handle_payment_failed(self, reference: str, payload: dict):
        """Handle failed payment: mark deposit as failed (no refund; wallet was never credited)."""
        from transactions.models import Transaction, TransactionType
        from transactions.services import TransactionService

        try:
            txn = Transaction.objects.filter(
                type=TransactionType.DEPOSIT,
                provider_reference=reference,
                status="PENDING",
            ).first()

            if not txn:
                logger.warning(f"No deposit transaction found for reference: {reference}")
                return Response(
                    {"message": "Transaction not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            TransactionService.mark_transaction_failed(
                txn,
                error_code="PAYMENT_FAILED",
                error_message="Payment was not completed",
            )
            logger.info(f"Deposit failed for transaction {txn.id}")
            return Response({"message": "Payment failed recorded"}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception(f"Error processing payment failure: {e}")
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PayVesselWebhookView(APIView):
    """
    Dedicated webhook endpoint for the PayVessel payment gateway.

    Configure in the PayVessel dashboard as:
        https://<your-domain>/api/integrations/payvessel/webhook/

    Security (per https://docs.payvessel.com/api-reference/webhook/verifying-webhooks):
    - Source IP is checked against PAYVESSEL_TRUSTED_IPS and rejected by default;
      PAYVESSEL_ENFORCE_IP_ALLOWLIST=False is an explicit compatibility override.
    - Signature: HMAC-SHA512 of the raw body keyed with the PayVessel secret
      (``PVSECRET-``), compared against the ``payvessel-http-signature`` header
      (``HTTP_PAYVESSEL_HTTP_SIGNATURE`` in ``request.META``).
    - Deliveries are idempotent, keyed on the per-payment transaction reference.

    Processing: with PAYVESSEL_WEBHOOK_ASYNC (default) the verified event is stored in
    ``WebhookEvent``, 200 is returned right away and processing runs in the
    background with retries (see ``integrations.payvessel_processing``). Otherwise it
    is processed inline: 200 = handled, 400 = rejected, 5xx = PayVessel should retry.
    """

    permission_classes = [AllowAny]

    @staticmethod
    def _signature(request) -> Optional[str]:
        # request.headers strips the HTTP_ prefix; META keeps it.
        return request.META.get("HTTP_PAYVESSEL_HTTP_SIGNATURE")

    @staticmethod
    def _client_ip(request) -> str:
        proxies = int(getattr(settings, "PAYVESSEL_TRUSTED_PROXY_COUNT", 1))
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
        if proxies > 0 and forwarded:
            hops = [h.strip() for h in forwarded.split(",") if h.strip()]
            # Entries to the left of our own proxies are client-controlled.
            if len(hops) >= proxies:
                return hops[-proxies]
        return request.META.get("REMOTE_ADDR") or ""

    def _ip_allowed(self, request) -> bool:
        trusted = getattr(settings, "PAYVESSEL_TRUSTED_IPS", [])
        if not trusted:
            logger.error("PAYVESSEL_TRUSTED_IPS is empty; rejecting webhook")
            return False
        return self._client_ip(request) in trusted

    @extend_schema(request=OpenApiTypes.OBJECT, responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        from integrations import payvessel_processing as processing
        from integrations.payments.client import get_client, PaymentGatewayException
        from integrations.payments.payvessel_va import redact_sensitive

        client = get_client("payvessel")
        verify = not getattr(settings, "PAYVESSEL_SKIP_WEBHOOK_VERIFY", False)

        enforce_ip = getattr(settings, "PAYVESSEL_ENFORCE_IP_ALLOWLIST", True)
        if verify and enforce_ip and not self._ip_allowed(request):
            # Diagnostics: show the whole chain and whether the signature is genuine, so
            # an IP-list mismatch (PayVessel changed IPs) can be told apart from a forgery.
            logger.warning(
                "PayVessel webhook from untrusted IP: %s | remote_addr=%s xff=%r signature_valid=%s",
                self._client_ip(request),
                request.META.get("REMOTE_ADDR"),
                request.META.get("HTTP_X_FORWARDED_FOR", ""),
                client._verify_webhook_signature(request.body, self._signature(request)),
            )
            return Response({"error": "Invalid signature or IP"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = client.handle_webhook(request.body, self._signature(request))
        except PaymentGatewayException as e:
            return Response({"error": str(e.detail)}, status=status.HTTP_400_BAD_REQUEST)

        if verify and not enforce_ip and not self._ip_allowed(request):
            # Signature is the authentication; the IP list is advisory (proxies and
            # PayVessel's sender IPs change). Keep the signal for monitoring.
            logger.warning(
                "PayVessel webhook from unlisted IP %s (signature valid, IP allowlist not enforced)",
                self._client_ip(request),
            )

        # Audit trail (PII masked).
        logger.info("PayVessel webhook received | %s", redact_sensitive(result.raw))

        if processing.is_ignored_event(result.event):
            return Response({"success": True, "message": "Event ignored"}, status=status.HTTP_200_OK)

        if not result.payment_reference:
            logger.error("PayVessel webhook missing transaction reference: %s", redact_sensitive(result.raw))
            return Response(
                {"error": "Missing payment reference in webhook"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if getattr(settings, "PAYVESSEL_WEBHOOK_ASYNC", True):
            with db_transaction.atomic():
                event, created = processing.store_event(result, result.raw)
                if created:
                    processing.dispatch(event.pk)
            message = "Accepted" if created else "Already received"
            return Response({"success": True, "message": message}, status=status.HTTP_200_OK)

        outcome = processing.process_result(result)
        return Response(outcome.body, status=outcome.status_code)


class SMEPlugWebhookView(APIView):
    """
    Webhook endpoint for SMEPlug VTU transaction status callbacks.

    Configure this URL in your SMEPlug dashboard as:
        https://<your-domain>/api/integrations/smeplug/webhook/
    """

    permission_classes = [AllowAny]

    def _verify_signature(self, request) -> bool:
        signature = request.headers.get("X-SMEPlug-Signature") or request.headers.get("X-Webhook-Signature")
        if not signature:
            return True

        secret = getattr(settings, "SMEPLUG_WEBHOOK_SECRET", "")
        if not secret:
            logger.warning("SMEPLUG_WEBHOOK_SECRET not set; skipping signature check")
            return True

        expected = hmac.new(
            secret.encode(), request.body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(signature, expected)

    @extend_schema(request=OpenApiTypes.OBJECT, responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        if not settings.DEBUG and not self._verify_signature(request):
            logger.warning("Invalid SMEPlug webhook signature")
            return Response({"error": "Invalid signature"}, status=status.HTTP_401_UNAUTHORIZED)

        payload = request.data
        logger.info("SMEPlug webhook received: %s", payload)

        reference = (
            payload.get("reference")
            or payload.get("order_id")
            or payload.get("transaction_id")
        )
        status_val = str(payload.get("status", "")).lower()

        if not reference:
            logger.warning("SMEPlug webhook missing reference: %s", payload)
            return Response({"message": "ok"}, status=status.HTTP_200_OK)

        from transactions.models import Transaction, TransactionType
        from transactions.services import TransactionService

        try:
            txn = (
                Transaction.objects.select_for_update()
                .filter(provider_reference=reference, status="PENDING")
                .first()
            )

            if not txn:
                logger.info("SMEPlug webhook: no pending transaction for ref %s", reference)
                return Response({"message": "ok"}, status=status.HTTP_200_OK)

            with db_transaction.atomic():
                if status_val in {"success", "successful", "completed", "delivered"}:
                    txn.status = "SUCCESS"
                    txn.provider_response = payload
                    txn.save(update_fields=["status", "provider_response"])
                    logger.info("SMEPlug webhook: marked txn %s SUCCESS", txn.id)
                elif status_val in {"failed", "failure", "error"}:
                    TransactionService.mark_transaction_failed(
                        txn,
                        error_code="SMEPLUG_FAILED",
                        error_message=payload.get("message") or "SMEPlug transaction failed",
                    )
                    logger.info("SMEPlug webhook: marked txn %s FAILED", txn.id)
                    # Vending transactions debit the wallet at purchase time, so
                    # a failed callback must credit it back. Guard is_refunded to
                    # stay idempotent if the webhook is delivered more than once.
                    if txn.type != TransactionType.DEPOSIT and not txn.is_refunded:
                        TransactionService.refund_transaction(txn)
                        logger.info("SMEPlug webhook: auto-refunded txn %s", txn.id)

        except Exception as e:
            logger.exception("SMEPlug webhook processing error: %s", e)

        return Response({"message": "ok"}, status=status.HTTP_200_OK)
