"""
Payment gateway client for wallet deposits (PaymentPoint-compatible).

- Initiate payment (get authorization_url for redirect)
- Verify payment status
- Process webhooks (HMAC signature verification, PaymentPoint payload format)
"""
import hmac
import hashlib
import json
import logging
from dataclasses import dataclass
from typing import Dict, Optional

import requests
from urllib.parse import quote
from django.conf import settings

from common.exceptions import PaymentGatewayException

logger = logging.getLogger(__name__)


@dataclass
class PaymentInitResult:
    success: bool
    payment_reference: Optional[str] = None
    payment_url: Optional[str] = None
    authorization_url: Optional[str] = None
    message: str = ""
    raw: Optional[Dict] = None


@dataclass
class PaymentVerificationResult:
    success: bool
    amount: Optional[float] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    payment_reference: Optional[str] = None
    message: str = ""
    raw: Optional[Dict] = None


@dataclass
class WebhookResult:
    success: bool
    payment_reference: Optional[str] = None
    amount: Optional[float] = None
    status: Optional[str] = None
    receiver_account_number: Optional[str] = None
    customer_id: Optional[str] = None
    message: str = ""
    raw: Optional[Dict] = None
    event: str = ""
    tracking_reference: Optional[str] = None
    settlement_amount: Optional[float] = None
    fee: Optional[float] = None


class PaymentPointClient:
    """
    PaymentPoint gateway client (original provider).
    Uses PAYMENTPOINT_* and PAYMENT_* settings.
    """

    def __init__(self):
        self.secret_key = getattr(settings, "PAYMENT_SECRET_KEY", "") or getattr(
            settings, "PAYMENTPOINT_BEARER_TOKEN", ""
        )
        self.public_key = getattr(settings, "PAYMENT_PUBLIC_KEY", "")
        self.webhook_secret = (
            getattr(settings, "PAYMENTPOINT_WEBHOOK_SECRET", "")
            or getattr(settings, "PAYMENT_WEBHOOK_SECRET", "")
        )
        self.base_url = (getattr(settings, "PAYMENTPOINT_BASE_URL", "") or "").rstrip("/")
        self.gateway_token = getattr(settings, "PAYMENTPOINT_BEARER_TOKEN", "") or self.secret_key
        self.api_key = getattr(settings, "PAYMENTPOINT_API_KEY", "")
        self.business_id = getattr(settings, "PAYMENTPOINT_BUSINESS_ID", "")

        if not self.base_url or not self.gateway_token:
            logger.debug("PaymentPoint not fully configured (base_url or token missing)")

    def is_configured(self) -> bool:
        """Return True if enough config is present to call the gateway."""
        return bool(self.base_url and self.gateway_token)

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self.gateway_token:
            headers["Authorization"] = f"Bearer {self.gateway_token}"
        if self.api_key:
            headers["api-key"] = self.api_key
        return headers

    def _verify_webhook_signature(self, payload: bytes, signature: Optional[str]) -> bool:
        # In DEBUG we allow unsigned webhooks for easier local testing.
        if getattr(settings, "DEBUG", False):
            return True
        if not signature:
            logger.warning("Missing payment webhook signature header")
            return False
        if not self.webhook_secret:
            logger.warning("Webhook secret not configured; rejecting webhook")
            return False
        try:
            body_str = payload.decode("utf-8")
            computed = hmac.new(
                self.webhook_secret.encode("utf-8"),
                body_str.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
            return hmac.compare_digest(computed, signature)
        except Exception as e:
            logger.error("Error verifying webhook signature: %s", e)
            return False

    def initiate_payment(
        self,
        amount: float,
        email: str,
        reference: str,
        callback_url: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ) -> PaymentInitResult:
        """Initiate payment; returns authorization_url for redirect."""
        logger.info("Initiating payment: %s - Amount: %s", reference, amount)

        headers = self._get_headers()
        payload = {
            "amount": amount,
            "email": email,
            "reference": reference,
            "callbackUrl": callback_url,
            "metadata": metadata or {},
            "businessId": self.business_id,
        }

        endpoints = getattr(
            settings,
            "PAYMENTPOINT_INIT_ENDPOINTS",
            ["/api/v1/initiatePayment", "/api/v1/createPayment", "/api/v1/initialize"],
        )
        if isinstance(endpoints, str):
            endpoints = [e.strip() for e in endpoints.split(",") if e.strip()]

        for ep in endpoints:
            url = f"{self.base_url}{ep}"
            try:
                resp = requests.post(url, headers=headers, json=payload, timeout=30)
            except requests.RequestException as exc:
                logger.warning("Request exception at %s: %s", url, exc)
                continue

            try:
                data = resp.json()
            except Exception:
                data = {"status_code": resp.status_code, "text": resp.text}

            if resp.status_code in (200, 201):
                payment_reference = (
                    data.get("reference")
                    or data.get("payment_reference")
                    or data.get("transaction_id")
                    or data.get("id")
                )
                payment_url = (
                    data.get("authorization_url")
                    or data.get("authorizationUrl")
                    or data.get("payment_url")
                    or data.get("paymentUrl")
                    or data.get("redirect_url")
                )
                message = data.get("message") or data.get("status") or ""
                return PaymentInitResult(
                    success=True,
                    payment_reference=str(payment_reference) if payment_reference else None,
                    payment_url=payment_url,
                    authorization_url=payment_url,
                    message=message,
                    raw=data,
                )
            logger.warning("Initiate returned %s from %s: %s", resp.status_code, url, resp.text)

        return PaymentInitResult(
            success=False,
            message="Payment initiation failed: no valid response from gateway",
            raw={"attempted_endpoints": endpoints},
        )

    def verify_payment(self, reference: str) -> PaymentVerificationResult:
        """Verify payment status at the gateway."""
        logger.info("Verifying payment: %s", reference)
        headers = self._get_headers()
        endpoints = getattr(
            settings,
            "PAYMENTPOINT_VERIFY_ENDPOINTS",
            ["/api/v1/verifyPayment", "/api/v1/transactions/verify"],
        )
        if isinstance(endpoints, str):
            endpoints = [e.strip() for e in endpoints.split(",") if e.strip()]

        for ep in endpoints:
            base = f"{self.base_url}{ep}"
            for url in [f"{base.rstrip('/')}/{reference}", base]:
                try:
                    resp = requests.get(
                        url, headers=headers, timeout=20, params={"reference": reference}
                    )
                except requests.RequestException:
                    continue
                if resp.status_code != 200:
                    continue
                try:
                    data = resp.json()
                except Exception:
                    data = {}
                status_val = (
                    data.get("status")
                    or data.get("transaction_status")
                    or data.get("payment_status")
                )
                amount = data.get("amount") or data.get("amount_paid")
                payment_ref = (
                    data.get("reference")
                    or data.get("payment_reference")
                    or data.get("transaction_id")
                    or reference
                )
                success = False
                if status_val is not None:
                    success = str(status_val).strip().lower() in {"paid", "success", "successful"}
                amount_float = float(amount) if amount is not None else None
                return PaymentVerificationResult(
                    success=success,
                    amount=amount_float,
                    currency=data.get("currency") or data.get("currency_code"),
                    status=str(status_val) if status_val else None,
                    payment_reference=str(payment_ref) if payment_ref else None,
                    message=data.get("message", ""),
                    raw=data,
                )

        return PaymentVerificationResult(
            success=False,
            payment_reference=reference,
            message="Payment verification failed",
        )

    def handle_webhook(self, payload: bytes, signature: Optional[str]) -> WebhookResult:
        """Verify signature and parse PaymentPoint-style webhook payload."""
        if not self._verify_webhook_signature(payload, signature):
            logger.warning("Invalid payment webhook signature")
            raise PaymentGatewayException("Invalid webhook signature")

        try:
            data = json.loads(payload.decode("utf-8"))
        except json.JSONDecodeError as e:
            logger.error("Invalid webhook JSON: %s", e)
            raise PaymentGatewayException("Invalid webhook payload")

        notification_status = data.get("notification_status")
        transaction_status = data.get("transaction_status")
        transaction_id = data.get("transaction_id")
        amount_paid = data.get("amount_paid")
        receiver = data.get("receiver") or {}
        customer = data.get("customer") or {}
        receiver_account_number = (
            receiver.get("account_number")
            or data.get("receiver_account_number")
            or data.get("account_number")
        )
        customer_id = customer.get("customer_id") or customer.get("id")

        logger.info(
            "Processing payment webhook: %s / %s",
            notification_status,
            transaction_status,
        )

        payment_reference = str(transaction_id) if transaction_id is not None else None
        status = transaction_status or notification_status

        amount_float = None
        if amount_paid is not None:
            try:
                amount_float = float(amount_paid)
            except (TypeError, ValueError):
                pass

        return WebhookResult(
            success=True,
            payment_reference=payment_reference,
            amount=amount_float,
            status=status,
            receiver_account_number=receiver_account_number,
            customer_id=customer_id,
            message="Webhook processed",
            raw=data,
        )


class PayVesselClient:
    """
    PayVessel gateway client (alternative deposit provider).

    Docs: https://docs.payvessel.com
    - Init:   POST {base_url}/pms/transactions/initialize/  (headers: api-key, api-secret)
    - Verify: GET  {base_url}/pms/transactions/{reference}/confirm/
    - Webhook: HMAC-SHA512 of raw body with the secret (``PVSECRET-`` key),
      compared against the ``HTTP_PAYVESSEL_HTTP_SIGNATURE`` header.
    """

    def __init__(self):
        self.base_url = (getattr(settings, "PAYVESSEL_BASE_URL", "https://api.payvessel.com") or "").rstrip("/")
        self.api_key = getattr(settings, "PAYVESSEL_API_KEY", "")
        self.secret = getattr(settings, "PAYVESSEL_SECRET", "")
        self.webhook_secret = (
            getattr(settings, "PAYVESSEL_WEBHOOK_SECRET", "") or self.secret
        )
        self.currency = getattr(settings, "PAYVESSEL_CURRENCY", "NGN")
        self.channels = getattr(settings, "PAYVESSEL_CHANNELS", ["BANK_TRANSFER", "CARD"])
        self.timeout = getattr(settings, "PAYVESSEL_REQUEST_TIMEOUT", 30)

        if not self.api_key or not self.secret:
            logger.debug("PayVessel not fully configured (api_key or secret missing)")

    def is_configured(self) -> bool:
        return bool(self.base_url and self.api_key and self.secret)

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "api-key": self.api_key,
            "api-secret": self.secret,
        }

    def _verify_webhook_signature(self, payload: bytes, signature: Optional[str]) -> bool:
        # Explicit opt-out for local testing only (never tied to DEBUG).
        if getattr(settings, "PAYVESSEL_SKIP_WEBHOOK_VERIFY", False):
            return True
        if not signature:
            logger.warning("Missing PayVessel webhook signature header")
            return False
        if not self.webhook_secret:
            logger.warning("PayVessel webhook secret not configured; rejecting webhook")
            return False
        try:
            computed = hmac.new(
                self.webhook_secret.encode("utf-8"),
                payload,
                hashlib.sha512,
            ).hexdigest()
            return hmac.compare_digest(computed, signature.strip())
        except Exception as e:
            logger.error("Error verifying PayVessel webhook signature: %s", e)
            return False

    def initiate_payment(
        self,
        amount: float,
        email: str,
        reference: str,
        callback_url: Optional[str] = None,
        metadata: Optional[Dict] = None,
        customer_name: Optional[str] = None,
        customer_phone_number: Optional[str] = None,
    ) -> PaymentInitResult:
        """Initialize a PayVessel checkout; returns checkout_url for redirect."""
        logger.info("Initiating PayVessel payment: %s - Amount: %s", reference, amount)

        payload: Dict = {
            "amount": str(amount),
            "currency": self.currency,
            "channels": self.channels,
            "customer_email": email,
            "reference": reference,
            "metadata": metadata or {},
        }
        if callback_url:
            payload["redirect_url"] = callback_url
        if customer_name:
            payload["customer_name"] = customer_name
        if customer_phone_number:
            payload["customer_phone_number"] = customer_phone_number

        url = f"{self.base_url}/pms/transactions/initialize/"
        try:
            resp = requests.post(
                url, headers=self._get_headers(), json=payload, timeout=self.timeout
            )
        except requests.RequestException as exc:
            logger.error("PayVessel initialize request exception: %s", exc)
            return PaymentInitResult(
                success=False, message=f"PayVessel request failed: {exc}"
            )

        try:
            data = resp.json()
        except Exception:
            data = {"status_code": resp.status_code, "text": resp.text}

        if resp.status_code in (200, 201) and data.get("status") is not False:
            inner = data.get("data") or {}
            payment_reference = (
                inner.get("transaction_ref")
                or inner.get("reference")
                or inner.get("id")
            )
            payment_url = (
                inner.get("checkout_url")
                or inner.get("payment_link")
                or inner.get("redirect_url")
            )
            return PaymentInitResult(
                success=bool(payment_url or payment_reference),
                payment_reference=str(payment_reference) if payment_reference else None,
                payment_url=payment_url,
                authorization_url=payment_url,
                message=data.get("message", ""),
                raw=data,
            )

        logger.warning("PayVessel initiate returned %s: %s", resp.status_code, data)
        return PaymentInitResult(
            success=False,
            message=str(data.get("message") or "PayVessel payment initiation failed"),
            raw=data,
        )

    def verify_payment(
        self, reference: str, timeout: Optional[float] = None
    ) -> PaymentVerificationResult:
        """
        Verify a PayVessel transaction by reference.

        ``result.status`` is the raw PayVessel status (success, failed, pending,
        abandoned, cancelled). Only ``success`` sets ``result.success``; callers
        should treat ``pending`` as "check again later", not as a failure.
        """
        logger.info("Verifying PayVessel payment: %s", reference)
        url = f"{self.base_url}/pms/transactions/{quote(str(reference), safe='')}/confirm/"
        try:
            resp = requests.get(
                url, headers=self._get_headers(), timeout=timeout or self.timeout
            )
        except requests.RequestException as exc:
            logger.error("PayVessel verify request exception: %s", exc)
            return PaymentVerificationResult(
                success=False, payment_reference=reference, message=str(exc)
            )

        try:
            data = resp.json()
        except Exception:
            data = {}

        if resp.status_code == 200 and data.get("status") != "error":
            inner = data.get("data") or {}
            status_val = inner.get("status") or data.get("status")
            amount = inner.get("amount")
            success = status_val is not None and str(status_val).strip().lower() in {
                "paid",
                "success",
                "successful",
                "completed",
            }
            amount_float = None
            if amount is not None:
                try:
                    amount_float = float(amount)
                    # PayVessel documents verification amounts in the smallest
                    # currency unit. Keep the setting as an escape hatch for a
                    # legacy account whose live response contract differs.
                    if getattr(settings, "PAYVESSEL_VERIFY_AMOUNT_IN_KOBO", True):
                        amount_float /= 100.0
                except (TypeError, ValueError):
                    pass
            return PaymentVerificationResult(
                success=success,
                amount=amount_float,
                currency=inner.get("currency") or self.currency,
                status=str(status_val) if status_val else None,
                payment_reference=str(inner.get("reference") or reference),
                message=data.get("message", ""),
                raw=data,
            )

        return PaymentVerificationResult(
            success=False,
            payment_reference=reference,
            message="PayVessel payment verification failed",
            raw=data,
        )

    def handle_webhook(self, payload: bytes, signature: Optional[str]) -> WebhookResult:
        """Verify signature and parse a PayVessel-style webhook payload."""
        if not self._verify_webhook_signature(payload, signature):
            logger.warning("Invalid PayVessel webhook signature")
            raise PaymentGatewayException("Invalid webhook signature")

        try:
            data = json.loads(payload.decode("utf-8"))
        except json.JSONDecodeError as e:
            logger.error("Invalid PayVessel webhook JSON: %s", e)
            raise PaymentGatewayException("Invalid webhook payload")

        return self.parse_webhook(data)

    def parse_webhook(self, data: Dict) -> WebhookResult:
        """Parse an already-verified PayVessel webhook payload (also used to re-process stored events)."""
        event = data.get("event", "")
        transaction = data.get("transaction") or {}
        order = data.get("order") or {}
        metadata = data.get("metadata") or {}

        # Per-payment reference only. Never fall back to an account-level
        # identifier (account number / tracking reference): static virtual
        # accounts receive many payments and would dedupe against each other.
        payment_reference = (
            transaction.get("reference")
            or data.get("reference")
            or metadata.get("payment_reference")
            or metadata.get("order_id")
        )
        status_val = (
            transaction.get("status")
            or order.get("status")
            or data.get("transaction_status")
            or data.get("notification_status")
            or data.get("status")
        )
        if isinstance(status_val, bool):
            status_val = "success" if status_val else "failed"
        # Reserved-account transfer callbacks use ``message``/``code`` rather
        # than the checkout transaction status fields.  Only accept the
        # documented success code (or an explicit success message) here; an
        # arbitrary message must never turn into a wallet credit.
        if not status_val:
            message_status = str(data.get("message") or "").strip().lower()
            if str(data.get("code") or "").strip() == "00" or message_status in {
                "success",
                "successful",
                "completed",
            }:
                status_val = "success"
        amount = (
            order.get("amount")
            or transaction.get("amount")
            or data.get("amount")
            or data.get("amount_paid")
        )
        settlement_amount = order.get("settlement_amount")
        fee = order.get("fee")

        # Receiver account number — used to credit virtual accounts on
        # reserved-account bank-transfer events (no pre-created transaction).
        receiver_account_number = (
            data.get("accountNumber")
            or data.get("account_number")
            or (data.get("virtualAccount") or {}).get("virtualAccountNumber")
            or (data.get("virtualAccount") or {}).get("accountNumber")
            or (data.get("virtual_account") or {}).get("virtual_account_number")
            or (data.get("virtual_account") or {}).get("account_number")
            or transaction.get("account_number")
            or transaction.get("accountNumber")
            or (data.get("receiver") or {}).get("account_number")
            or (data.get("account") or {}).get("accountNumber")
            or (data.get("customer") or {}).get("accountNumber")
            or metadata.get("account_number")
            or metadata.get("accountNumber")
        )
        if not receiver_account_number:
            banks = data.get("banks")
            if isinstance(banks, dict):
                receiver_account_number = banks.get("accountNumber") or banks.get("account_number")
            elif isinstance(banks, list) and banks:
                receiver_account_number = banks[0].get("accountNumber") or banks[0].get("account_number")

        # Reserved-account tracking reference: identifies the *account*, never the
        # payment, so it is only used to find the account owner.
        banks_obj = data.get("banks")
        if isinstance(banks_obj, list):
            banks_obj = banks_obj[0] if banks_obj and isinstance(banks_obj[0], dict) else {}
        tracking_reference = (
            data.get("trackingReference")
            or data.get("tracking_reference")
            or transaction.get("trackingReference")
            or (banks_obj.get("trackingReference") if isinstance(banks_obj, dict) else None)
            or metadata.get("trackingReference")
            or metadata.get("tracking_reference")
            or ((data.get("virtualAccount") or {}).get("trackingReference"))
            or ((data.get("virtual_account") or {}).get("tracking_reference"))
        )

        # Event name wins for success determination (transaction.success etc.)
        if event.endswith("success") or event.endswith("completed"):
            status_val = "success"
        elif event.endswith("failed") or event.endswith("abandoned"):
            status_val = "failed"

        logger.info(
            "Processing PayVessel webhook: event=%s status=%s ref=%s",
            event,
            status_val,
            payment_reference,
        )

        def _to_float(v):
            if v is None:
                return None
            try:
                return float(v)
            except (TypeError, ValueError):
                return None

        amount_float = _to_float(amount)

        return WebhookResult(
            success=True,
            event=event,
            tracking_reference=str(tracking_reference) if tracking_reference else None,
            settlement_amount=_to_float(settlement_amount),
            fee=_to_float(fee),
            payment_reference=str(payment_reference) if payment_reference else None,
            amount=amount_float,
            status=str(status_val) if status_val else None,
            receiver_account_number=str(receiver_account_number) if receiver_account_number else None,
            message="Webhook processed",
            raw=data,
        )


_client_instance: Optional[PaymentPointClient] = None
_payvessel_client_instance: Optional["PayVesselClient"] = None

SUPPORTED_PAYMENT_PROVIDERS = ("paymentpoint", "payvessel")


def get_client(provider: Optional[str] = None):
    """Return the payment client for the given provider.

    Defaults to ``settings.DEFAULT_PAYMENT_PROVIDER`` (paymentpoint).
    """
    global _client_instance, _payvessel_client_instance

    provider = (provider or getattr(settings, "DEFAULT_PAYMENT_PROVIDER", "paymentpoint") or "paymentpoint").strip().lower()
    if provider == "payvessel":
        if _payvessel_client_instance is None:
            _payvessel_client_instance = PayVesselClient()
        return _payvessel_client_instance
    if _client_instance is None:
        _client_instance = PaymentPointClient()
    return _client_instance


def initiate_payment(
    amount: float,
    email: str,
    reference: str,
    callback_url: Optional[str] = None,
    metadata: Optional[Dict] = None,
    provider: Optional[str] = None,
) -> PaymentInitResult:
    return get_client(provider).initiate_payment(
        amount, email, reference, callback_url, metadata
    )


def verify_payment(reference: str, provider: Optional[str] = None) -> PaymentVerificationResult:
    return get_client(provider).verify_payment(reference)


def handle_webhook(payload: bytes, signature: Optional[str], provider: Optional[str] = None) -> WebhookResult:
    return get_client(provider).handle_webhook(payload, signature)
