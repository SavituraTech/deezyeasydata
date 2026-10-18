import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass
from .exceptions import ProviderFailedException, ProviderTimeoutException

logger = logging.getLogger(__name__)


@dataclass
class ProviderResult:
    """Normalized result object passed to the VendingStrategy."""
    success: bool
    is_pending: bool = False
    provider_ref: Optional[str] = None
    message: str = ""
    text_status: str = ""
    token: Optional[str] = None  # for electricity/education pins
    amount_charged: Optional[str] = None
    bonus_earned: Optional[str] = None
    raw: Optional[Dict[str, Any]] = None


@dataclass
class VerificationResult:
    """Result from verification API calls (meter, smartcard, broadband)."""
    success: bool
    message: str = ""
    customer_name: Optional[str] = None
    customer_address: Optional[str] = None
    meter_number: Optional[str] = None
    smartcard: Optional[str] = None
    status: Optional[str] = None
    raw: Optional[Dict[str, Any]] = None


@dataclass
class BalanceResult:
    """Provider balance information."""
    success: bool
    balances: list = None
    naira_balance: Optional[float] = None
    message: str = ""
    raw: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        if self.balances is None:
            self.balances = []


class ProviderAdapter:
    """
    Adapter bridging the generic ProviderClient HTTP responses 
    and the domain logic VendingStrategy. Translates 'fake successes' 
    into ProviderFailedException.
    """
    
    def __init__(self, client):
        self.client = client

    def _normalize_status(self, status: Any) -> bool:
        """Helper to safely parse provider boolean statuses."""
        if isinstance(status, bool):
            return status
        if isinstance(status, (int, float)):
            return status != 0
        if isinstance(status, str):
            val = status.strip().lower()
            return val in {"true", "1", "yes", "success"}
        return False
        
    def _check_for_failure(self, response: Dict[str, Any]) -> None:
        """Inspects the raw response and raises an exception if it's a logical failure."""
        status = self._normalize_status(response.get("status"))
        text_status = str(response.get("text_status", "")).upper()
        action = response.get("action", "unknown")

        message = response.get("server_message") or response.get("message") or "Provider operation failed."

        if not status:
            logger.warning("Provider logical failure | action=%s message=%s", action, message)
            raise ProviderFailedException(message)

        # Specific check for 'vend' action COMPLETED states
        if action == "vend" and text_status != "COMPLETED":
            if text_status == "PENDING":
                logger.warning("Provider vend pending | text_status=%s message=%s", text_status, message)
                raise ProviderTimeoutException(f"Transaction pending at provider. Status: {text_status}. Message: {message}")
            logger.warning("Provider vend not completed | text_status=%s message=%s", text_status, message)
            raise ProviderFailedException(f"Transaction not completed. Status: {text_status}. Message: {message}")

    def execute_vend(self, payload: Dict[str, Any]) -> ProviderResult:
        """
        Executes a vend operation and returns a normalized ProviderResult.
        Raises exceptions on network errors or logical provider failures.
        """
        response = self.client.make_request(payload)
        
        # Inject the action back into the response for context if it isn't there
        response["action"] = payload.get("action", "vend")
        
        status = self._normalize_status(response.get("status"))
        text_status = str(response.get("text_status", "")).upper()
        data = response.get("data", {})
        if not isinstance(data, dict):
            data = {}

        is_pending = status and text_status not in ("", "COMPLETED") and "SUCCESSFUL" not in text_status

        if not status:
            message = response.get("server_message") or response.get("message") or "Provider operation failed."
            raise ProviderFailedException(message)

        if is_pending:
            raise ProviderTimeoutException(
                f"Transaction pending at provider. Status: {text_status}. "
                f"Message: {response.get('server_message') or response.get('message', '')}"
            )

        # Success path
        return ProviderResult(
            success=True,
            is_pending=False,
            provider_ref=str(data.get("recharge_id")) if data.get("recharge_id") else None,
            message=response.get("server_message") or response.get("message") or "Transaction successful",
            text_status=text_status,
            token=data.get("token") or data.get("true_response"),
            amount_charged=data.get("amount_charged"),
            bonus_earned=data.get("bonus_earned"),
            raw=response
        )

    def execute_verify(self, payload: Dict[str, Any]) -> VerificationResult:
        """
        Executes a verify operation and returns a typed VerificationResult
        with customer details extracted from the raw response.
        """
        response = self.client.make_request(payload)
        response["action"] = payload.get("action", "verify")

        status = self._normalize_status(response.get("status"))
        text_status = str(response.get("text_status", "")).upper()
        message = response.get("server_message") or response.get("message") or "Verification failed"

        if not status or "SUCCESSFUL" not in text_status:
            raise ProviderFailedException(message)

        data = response.get("data", {})
        if not isinstance(data, dict):
            data = {}

        return VerificationResult(
            success=True,
            message=message,
            customer_name=data.get("name") or data.get("customer_name"),
            customer_address=data.get("address"),
            meter_number=data.get("meterNumber") or data.get("meter_number"),
            smartcard=data.get("smartcard"),
            status=data.get("status"),
            raw=response,
        )

    def get_balance(self) -> BalanceResult:
        """Get provider wallet balance."""
        response = self.client.make_request({"action": "balance"})
        status = self._normalize_status(response.get("status"))
        data = response.get("data", [])

        naira_balance = None
        balances = []
        if isinstance(data, list):
            balances = data
            for item in data:
                if isinstance(item, dict) and item.get("label") == "Naira Wallet":
                    try:
                        naira_balance = float(str(item.get("balance", "0")).replace("#", "").replace(",", "").strip())
                    except (ValueError, AttributeError):
                        pass
                    break

        return BalanceResult(
            success=status,
            balances=balances,
            naira_balance=naira_balance,
            message=response.get("server_message") or "",
            raw=response,
        )


class SMEPlugAdapter(ProviderAdapter):
    """
    Adapter for SMEPlug API responses.

    SMEPlug returns {"status": true/false, "message": "...", "data": {...}}.
    There is no text_status "COMPLETED" check — status=true means success.
    """

    def _check_for_failure(self, response: Dict[str, Any]) -> None:
        status = self._normalize_status(response.get("status"))
        if not status:
            message = response.get("message") or "SMEPlug operation failed."
            raise ProviderFailedException(message)

    def execute_vend(self, payload: Dict[str, Any]) -> ProviderResult:
        response = self.client.make_request(payload)
        self._check_for_failure(response)

        data = response.get("data", {})
        if not isinstance(data, dict):
            data = {}

        provider_ref = (
            data.get("reference")
            or data.get("order_id")
            or data.get("transaction_id")
            or data.get("id")
        )

        return ProviderResult(
            success=True,
            is_pending=False,
            provider_ref=str(provider_ref) if provider_ref else None,
            message=response.get("message") or "Transaction successful",
            text_status="COMPLETED",
            raw=response,
        )
