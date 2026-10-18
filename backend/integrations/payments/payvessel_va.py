"""
PayVessel reserved-account (virtual account) client.

Docs: https://docs.payvessel.com
- Auth headers: api-key, api-secret, Content-Type: application/json
- Create VA: POST {base}/pms/api/external/request/customerReservedAccount/
  body: {email, name, phoneNumber, bankcode: [...], account_type: STATIC|DYNAMIC,
         businessid, [bvn], [nin]}

KYC (bvn/nin) is optional: 9PSB (120001) STATIC without KYC works (30k daily
receive limit), DYNAMIC needs no KYC. Only sent when given (PlatformKYC or
explicit argument).
"""
import logging
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import requests
from urllib.parse import quote
from django.conf import settings

from common.exceptions import PaymentGatewayException

logger = logging.getLogger(__name__)

CREATE_VA_PATH = "/pms/api/external/request/customerReservedAccount/"

# STATIC accounts at these banks need a BVN or NIN at creation (PalmPay).
KYC_REQUIRED_STATIC_BANKS = {"999991"}

_SENSITIVE_KEYS = {
    "bvn", "nin", "email", "phonenumber", "phone", "phone_number",
    "customer_email", "customer_phone_number", "api-key", "api-secret",
}


def redact_sensitive(value):
    """Return a copy of ``value`` with PII/credentials masked, safe to log."""
    if isinstance(value, dict):
        return {
            k: ("***" if str(k).lower() in _SENSITIVE_KEYS else redact_sensitive(v))
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [redact_sensitive(v) for v in value]
    return value


@dataclass
class PayVesselVAAccount:
    bank_code: str = ""
    bank_name: Optional[str] = None
    account_number: str = ""
    account_name: Optional[str] = None
    account_type: Optional[str] = None
    expire_date: Optional[str] = None
    tracking_reference: Optional[str] = None


@dataclass
class PayVesselVAResult:
    success: bool
    accounts: List[PayVesselVAAccount] = field(default_factory=list)
    business: Optional[str] = None
    message: str = ""
    raw: Optional[Dict] = None


def _get_config():
    base_url = (getattr(settings, "PAYVESSEL_BASE_URL", "https://api.payvessel.com") or "").rstrip("/")
    api_key = getattr(settings, "PAYVESSEL_API_KEY", "")
    # Deezy Easy Data names the API secret PAYVESSEL_SECRET (with PAYVESSEL_SECRET_KEY
    # as an alias); fall back to PAYVESSEL_API_SECRET for parity with other repos.
    api_secret = (
        getattr(settings, "PAYVESSEL_SECRET", "")
        or getattr(settings, "PAYVESSEL_API_SECRET", "")
    )
    business_id = getattr(settings, "PAYVESSEL_BUSINESS_ID", "")
    return base_url, api_key, api_secret, business_id


def _headers() -> Dict[str, str]:
    _, api_key, api_secret, _ = _get_config()
    return {
        "api-key": api_key,
        "api-secret": api_secret,
        "Content-Type": "application/json",
        "Accept": "application/json",
        # Sandbox Cloudflare bans non-browser signatures (HTTP 403 error 1010);
        # see PAYVESSEL_USER_AGENT in settings.
        "User-Agent": getattr(settings, "PAYVESSEL_USER_AGENT", "DBN-Backend/1.0"),
    }


def get_virtual_account(account_number: str) -> Optional[PayVesselVAAccount]:
    """
    Fetch one reserved account: GET /pms/api/external/request/virtual-account/{businessid}/{account}/

    Returns ``None`` when PayVessel says the account does not exist (404).
    Raises ``PaymentGatewayException`` for any other failure. Safe to retry (read-only).
    """
    base_url, api_key, api_secret, business_id = _get_config()
    if not api_key or not api_secret or not business_id:
        raise PaymentGatewayException(
            "PayVessel credentials (api-key, api-secret, business id) must be configured."
        )
    account_number = str(account_number or "").strip()
    if not account_number:
        raise PaymentGatewayException("account_number is required.")

    url = (
        f"{base_url}/pms/api/external/request/virtual-account/"
        f"{quote(business_id, safe='')}/{quote(account_number, safe='')}/"
    )
    timeout = int(getattr(settings, "PAYVESSEL_REQUEST_TIMEOUT", 15))
    try:
        response = requests.get(url, headers=_headers(), timeout=timeout)
    except requests.RequestException as exc:
        raise PaymentGatewayException(f"PayVessel get virtual account failed: {exc}")

    if response.status_code == 404:
        return None
    if response.status_code != 200:
        logger.error(
            "PayVessel getVirtualAccount failed | status=%d body=%s",
            response.status_code, response.text[:500],
        )
        raise PaymentGatewayException(f"PayVessel returned HTTP {response.status_code}")
    try:
        b = response.json()
    except ValueError:
        raise PaymentGatewayException("PayVessel returned a non-JSON response.")
    if isinstance(b.get("data"), dict):  # tolerate an enveloped response
        b = b["data"]
    return PayVesselVAAccount(
        bank_code=str(b.get("bankCode", "")),
        bank_name=b.get("bankName"),
        account_number=str(b.get("accountNumber") or account_number),
        account_name=b.get("accountName"),
        account_type=b.get("account_type"),
        expire_date=b.get("expire_date"),
        tracking_reference=b.get("trackingReference"),
    )


def create_virtual_account(
    email: str,
    name: str,
    phone_number: str = "",
    bank_codes: Optional[List[str]] = None,
    account_type: Optional[str] = None,
    bvn: Optional[str] = None,
    nin: Optional[str] = None,
) -> PayVesselVAResult:
    """
    Create STATIC/DYNAMIC reserved account(s) on PayVessel.

    The POST is not idempotent, so it is never retried automatically: after a
    read timeout or 5xx the account may already exist, and a blind retry would
    create a duplicate.
    """
    base_url, api_key, api_secret, business_id = _get_config()
    if not api_key or not api_secret or not business_id:
        raise PaymentGatewayException(
            "PayVessel credentials (api-key, api-secret, business id) must be "
            "configured to create virtual accounts."
        )

    bank_codes = bank_codes or list(getattr(settings, "PAYVESSEL_BANK_CODES", ["120001", "999991"]))
    if isinstance(bank_codes, str):
        bank_codes = [b.strip() for b in bank_codes.split(",") if b.strip()]
    account_type = (account_type or getattr(settings, "PAYVESSEL_ACCOUNT_TYPE", "STATIC")).upper()
    if account_type not in ("STATIC", "DYNAMIC"):
        raise PaymentGatewayException(f"Invalid PayVessel account_type: {account_type}")

    if account_type == "STATIC" and not (bvn or nin):
        skipped = [b for b in bank_codes if b in KYC_REQUIRED_STATIC_BANKS]
        if skipped:
            logger.info(
                "PayVessel: skipping bank(s) %s for STATIC account without BVN/NIN", skipped
            )
            bank_codes = [b for b in bank_codes if b not in KYC_REQUIRED_STATIC_BANKS]
        if not bank_codes:
            raise PaymentGatewayException(
                "The selected bank(s) require a BVN or NIN to create a STATIC account."
            )

    url = f"{base_url}{CREATE_VA_PATH}"
    payload: Dict = {
        "email": email,
        "name": name,
        "phoneNumber": phone_number or "",
        "bankcode": bank_codes,
        "account_type": account_type,
        "businessid": business_id,
    }
    if bvn:
        payload["bvn"] = bvn
    if nin:
        payload["nin"] = nin

    timeout = int(getattr(settings, "PAYVESSEL_REQUEST_TIMEOUT", 15))
    logger.info(
        "PayVessel createVirtualAccount request | url=%s payload=%s",
        url, redact_sensitive(payload),
    )

    try:
        started = time.monotonic()
        response = requests.post(url, headers=_headers(), json=payload, timeout=timeout)
        elapsed = time.monotonic() - started
    except requests.ConnectionError as exc:
        # Includes ConnectTimeout: the request never reached PayVessel.
        raise PaymentGatewayException(f"PayVessel virtual account request failed: {exc}")
    except requests.Timeout as exc:
        # Read timeout: the account may or may not have been created.
        logger.error("PayVessel createVirtualAccount read timeout (not retried): %s", exc)
        raise PaymentGatewayException(
            "PayVessel did not respond in time; the account may have been created. "
            "Please check again shortly."
        )
    except requests.RequestException as exc:
        raise PaymentGatewayException(f"PayVessel virtual account request failed: {exc}")

    if response.status_code >= 400:
        try:
            body = redact_sensitive(response.json())
        except ValueError:
            body = response.text[:500]
        logger.error(
            "PayVessel createVirtualAccount failed | status=%d elapsed=%.3fs body=%s",
            response.status_code, elapsed, body,
        )
        raise PaymentGatewayException(f"PayVessel returned HTTP {response.status_code} — {body}")

    logger.info(
        "PayVessel createVirtualAccount response | status=%d elapsed=%.3fs",
        response.status_code, elapsed,
    )
    try:
        data = response.json()
    except ValueError:
        raise PaymentGatewayException("PayVessel returned a non-JSON response.")

    banks = data.get("banks") or data.get("bankAccounts") or []
    if isinstance(banks, dict):
        banks = [banks]
    if not banks:
        raise PaymentGatewayException(
            f"PayVessel returned no bank accounts. Response: {redact_sensitive(data)}"
        )

    accounts = []
    for b in banks:
        accounts.append(PayVesselVAAccount(
            bank_code=str(b.get("bankCode", "")),
            bank_name=b.get("bankName"),
            account_number=str(b.get("accountNumber", "")),
            account_name=b.get("accountName"),
            account_type=b.get("account_type") or account_type,
            expire_date=b.get("expire_date"),
            tracking_reference=b.get("trackingReference"),
        ))
    return PayVesselVAResult(
        success=True, accounts=accounts,
        business=data.get("business"), message="Virtual account(s) created", raw=data,
    )

