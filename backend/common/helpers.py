import re
import secrets
import string
import uuid
from decimal import Decimal
from typing import Optional


def generate_reference(prefix: str = "REF", length: int = 16) -> str:
    """Generate a unique reference string (secrets-based)."""
    random_str = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(length))
    return f"{prefix}_{random_str}"


def normalize_phone(phone: str) -> str:
    """
    Normalize a Nigerian phone number to 0xxx format (11 digits).
    Handles +234, 234, and 0 prefixes.
    """
    phone = re.sub(r"[\s\-\(\)]+", "", phone.strip())
    if phone.startswith("+234"):
        phone = "0" + phone[4:]
    elif phone.startswith("234") and len(phone) == 13:
        phone = "0" + phone[3:]
    return phone


def normalize_phone_number(phone: str, country_code: str = "234") -> Optional[str]:
    """Normalize phone to international format (234...) for backend parity."""
    digits = re.sub(r"\D", "", phone)
    if digits.startswith(country_code):
        return digits
    elif digits.startswith("0") and len(digits) == 11:
        return country_code + digits[1:]
    elif len(digits) == 10:
        return country_code + digits
    return None


def format_money(amount: Decimal, currency: str = "NGN") -> str:
    symbols = {"NGN": "₦", "USD": "$"}
    symbol = symbols.get(currency, currency)
    return f"{symbol}{amount:,.2f}"


def is_valid_nigerian_phone(phone: str) -> bool:
    """Validate that a phone number is a valid 11-digit Nigerian number."""
    normalized = normalize_phone(phone)
    return bool(re.match(r"^0[789][01]\d{8}$", normalized))


def format_naira(amount) -> str:
    """Format an amount as Nigerian Naira. e.g. ₦1,500.00"""
    try:
        return f"₦{float(amount):,.2f}"
    except (ValueError, TypeError):
        return f"₦{amount}"


SENSITIVE_KEYS = {"api_key", "token", "password", "pin", "secret", "authorization", "bearer"}


def sanitize_log_data(data: dict) -> dict:
    """Mask sensitive fields in a dictionary for safe logging."""
    if not isinstance(data, dict):
        return data
    sanitized = {}
    for key, value in data.items():
        if any(s in key.lower() for s in SENSITIVE_KEYS):
            sanitized[key] = "***REDACTED***"
        elif isinstance(value, dict):
            sanitized[key] = sanitize_log_data(value)
        else:
            sanitized[key] = value
    return sanitized
