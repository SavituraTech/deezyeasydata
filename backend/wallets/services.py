"""
Wallet service for managing wallet operations.
"""

import logging
import uuid
from decimal import Decimal
from typing import Optional

import requests
from django.conf import settings
from django.db import transaction

from .models import Wallet, Ledger, VirtualAccount, WalletConfig
from common.exceptions import InsufficientFundsException, PaymentGatewayException

logger = logging.getLogger(__name__)


def _paymentpoint_phone(phone: str) -> str:
    phone = (phone or "").replace(" ", "").replace("-", "")
    if phone.startswith("+234"):
        phone = "0" + phone[4:]
    elif phone.startswith("234"):
        phone = "0" + phone[3:]
    elif len(phone) == 10 and not phone.startswith("0"):
        phone = "0" + phone
    return phone


def _paymentpoint_data(response):
    response.raise_for_status()
    body = response.json()
    return body.get("data", body) if isinstance(body, dict) else body


def _paymentpoint_customer_id(value):
    if isinstance(value, dict):
        for key in ("id", "user_id", "customer_id", "customerId"):
            if value.get(key):
                return str(value[key])
        for key in ("data", "customer", "user"):
            found = _paymentpoint_customer_id(value.get(key))
            if found:
                return found
    return None


def _paymentpoint_accounts(value):
    found = []
    if isinstance(value, dict):
        number = value.get("account_number") or value.get("accountNumber")
        if number:
            found.append(value)
        for child in value.values():
            found.extend(_paymentpoint_accounts(child))
    elif isinstance(value, list):
        for child in value:
            found.extend(_paymentpoint_accounts(child))
    return found


def _sync_user_balance(wallet: "Wallet") -> None:
    """Keep User.balance in sync with wallet.balance for API and legacy code.

    This MUST be called inside an ``@transaction.atomic`` block so that the
    wallet and user balance updates commit together. If the user save fails,
    the wallet update is also rolled back, preventing drift.
    """
    if hasattr(wallet.user, "balance"):
        wallet.user.balance = wallet.balance
        wallet.user.save(update_fields=["balance"])


class WalletService:
    """Service for managing wallet operations with full audit trail."""

    @staticmethod
    def get_or_create_wallet(user) -> Wallet:
        """Get or create a wallet for a user."""
        wallet, created = Wallet.objects.get_or_create(user=user)
        return wallet

    @staticmethod
    def get_or_create_virtual_account(
        user,
        provider: Optional[str] = None,
        force_new: bool = False,
        bank_codes=None,
        account_type: Optional[str] = None,
        bvn: Optional[str] = None,
        nin: Optional[str] = None,
    ) -> VirtualAccount:
        """
        Get or create a provider-backed virtual account for the user.

        Deezy Easy Data uses PayVessel's ``customerReservedAccount`` endpoint
          (STATIC/DYNAMIC reserved accounts). KYC (bvn/nin) is optional and
          taken from PlatformKYC when available.

        Raises:
            PaymentGatewayException: if provider credentials are missing or the
            provider response is invalid.
        """
        config = WalletConfig.get_solo()
        if not config.payvessel_enabled:
            raise PaymentGatewayException("PayVessel is currently disabled.")
        return WalletService._create_payvessel_virtual_account(
            user, force_new=force_new, bank_codes=bank_codes,
            account_type=account_type, bvn=bvn, nin=nin,
        )

    @staticmethod
    def _create_paymentpoint_virtual_account(user, force_new: bool = False) -> VirtualAccount:
        """Get or create a PaymentPoint-backed virtual account for the user."""
        # Fast path — no lock needed, just a read.
        if not force_new:
            existing = VirtualAccount.objects.filter(
                user=user, provider="PAYMENTPOINT", is_active=True
            ).first()
            if existing:
                return existing

        base_url = (getattr(settings, "PAYMENTPOINT_BASE_URL", "") or "").rstrip("/")
        bearer = (getattr(settings, "PAYMENTPOINT_BEARER_TOKEN", "") or "").strip()
        api_key = (getattr(settings, "PAYMENTPOINT_API_KEY", "") or "").strip()
        business_id = (getattr(settings, "PAYMENTPOINT_BUSINESS_ID", "") or "").strip()

        if not base_url or not bearer or not api_key or not business_id:
            raise PaymentGatewayException(
                "PaymentPoint credentials (base URL, token, api-key, business id) "
                "must be configured to create virtual accounts."
            )

        id_type = getattr(user, "id_type", None)
        id_number = getattr(user, "id_number", None)
        if id_type not in ("bvn", "nin") or not id_number or len(id_number) != 11 or not id_number.isdigit():
            raise PaymentGatewayException(
                "Add a valid 11-digit BVN or NIN to your profile before generating an account."
            )

        bank_codes = getattr(
            settings,
            "PAYMENTPOINT_BANK_CODES",
            ["20946", "20897"],
        )
        if isinstance(bank_codes, str):
            bank_codes = [code.strip() for code in bank_codes.split(",") if code.strip()]

        headers = {
            "Authorization": f"Bearer {bearer}",
            "api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        email = user.email or f"{user.username}@deezyeasydata.example.com"
        phone = _paymentpoint_phone(getattr(user, "phone", "") or "")
        existing_mapping = VirtualAccount.objects.filter(
            user=user, provider="PAYMENTPOINT", external_customer_id__isnull=False
        ).exclude(external_customer_id="").first()
        customer_id = existing_mapping.external_customer_id if existing_mapping else None

        try:
            if not customer_id:
                customers = _paymentpoint_data(requests.get(
                    f"{base_url}/api/get/business/users", headers=headers, timeout=60
                ))
                rows = customers if isinstance(customers, list) else customers.get("data", [])
                match = next((row for row in rows if str(row.get("email", "")).lower() == email.lower()), None)
                customer_id = _paymentpoint_customer_id(match)

            if not customer_id:
                customer_payload = {
                    "first_name": getattr(user, "first_name", "") or user.username,
                    "last_name": getattr(user, "last_name", "") or "Customer",
                    "phone_number": phone,
                    "email": email,
                }
                customer_payload["idType"] = id_type
                customer_payload["idNumber"] = id_number
                created = _paymentpoint_data(requests.post(
                    f"{base_url}/api/create/business/customer",
                    headers=headers,
                    json=customer_payload,
                    timeout=60,
                ))
                customer_id = _paymentpoint_customer_id(created)

            if not customer_id:
                customers = _paymentpoint_data(requests.get(
                    f"{base_url}/api/get/business/users", headers=headers, timeout=60
                ))
                rows = customers if isinstance(customers, list) else customers.get("data", [])
                match = next((row for row in rows if str(row.get("email", "")).lower() == email.lower()), None)
                customer_id = _paymentpoint_customer_id(match)

            if not customer_id:
                raise PaymentGatewayException("PaymentPoint customer was created but no customer ID was returned.")

            bank_accounts = []
            raw_responses = []
            for bank_code in bank_codes:
                try:
                    created = _paymentpoint_data(requests.post(
                        f"{base_url}/api/create/reserved-account",
                        headers=headers,
                        json={"user_id": customer_id, "bank_type": int(bank_code), "idType": id_type, "idNumber": id_number},
                        timeout=60,
                    ))
                    raw_responses.append(created)
                    bank_accounts.extend(_paymentpoint_accounts(created))
                except requests.HTTPError as exc:
                    if exc.response is None or exc.response.status_code not in (400, 409, 422):
                        raise
                    raw_responses.append({"status": exc.response.status_code, "body": exc.response.text[:500]})

            if not bank_accounts:
                listing = _paymentpoint_data(requests.get(
                    f"{base_url}/api/reserved/account/total",
                    headers=headers,
                    params={"search": email, "page": 1, "per_page": 100},
                    timeout=60,
                ))
                bank_accounts = _paymentpoint_accounts(listing)
                raw_responses.append(listing)
            data = {"customer_id": customer_id, "responses": raw_responses}
        except PaymentGatewayException:
            raise
        except (requests.RequestException, ValueError, TypeError) as exc:
            response = getattr(exc, "response", None)
            detail = (getattr(response, "text", "") or str(exc))[:500]
            raise PaymentGatewayException(f"Failed to create PaymentPoint reserved account: {detail}")

        if not bank_accounts:
            raise PaymentGatewayException(
                "Virtual account creation succeeded but no bank accounts were returned "
                "by PaymentPoint."
            )

        # Atomically lock-and-recheck before saving so two concurrent requests that
        # both raced past the fast-path read don't create duplicate records.
        with transaction.atomic():
            if not force_new:
                existing = VirtualAccount.objects.select_for_update().filter(
                    user=user, provider="PAYMENTPOINT", is_active=True
                ).first()
                if existing:
                    return existing

            first_va: Optional[VirtualAccount] = None
            for acct in bank_accounts:
                account_number = str(acct.get("account_number") or acct.get("accountNumber") or "").strip()
                if not account_number:
                    continue

                account_name = (
                    acct.get("account_name") or acct.get("accountName")
                    or getattr(user, "get_full_name", lambda: user.username)()
                    or user.username
                )
                bank_name = acct.get("bank_name") or acct.get("bankName") or getattr(
                    settings, "PAYMENTPOINT_DEFAULT_BANK_NAME", "Deezy Easy Data Partner Bank"
                )

                va, _created = VirtualAccount.objects.get_or_create(
                    account_number=account_number,
                    defaults={
                        "user": user,
                        "provider": "PAYMENTPOINT",
                        "account_name": account_name,
                        "bank_name": bank_name,
                        "external_customer_id": customer_id,
                        "metadata": data,
                    },
                )
                if first_va is None:
                    first_va = va

        if not first_va:
            raise PaymentGatewayException(
                "PaymentPoint response did not contain any usable bank accounts."
            )

        return first_va

    @staticmethod
    def _create_payvessel_virtual_account(
        user,
        force_new: bool = False,
        bank_codes=None,
        account_type: Optional[str] = None,
        bvn: Optional[str] = None,
        nin: Optional[str] = None,
    ) -> VirtualAccount:
        """Get or create PayVessel reserved-account virtual account(s) for the user."""
        from integrations.payments import payvessel_va

        # Fast path — no lock needed, just a read.
        if not force_new:
            existing = VirtualAccount.objects.filter(
                user=user, provider="PAYVESSEL", is_active=True
            ).first()
            if existing:
                return existing

        # Fall back to the shared business KYC identity when it matches (optional).
        if not bvn and not nin:
            from .models import PlatformKYC
            kyc = PlatformKYC.get_solo()
            if kyc.id_type == "bvn" and kyc.id_number:
                bvn = kyc.id_number
            elif kyc.id_type == "nin" and kyc.id_number:
                nin = kyc.id_number

        full_name = (
            getattr(user, "get_full_name", lambda: user.username)() or user.username
        ).strip()
        result = payvessel_va.create_virtual_account(
            email=user.email or f"{user.username}@deezyeasydata.example.com",
            name=full_name.upper(),
            phone_number=getattr(user, "phone", "") or "",
            bank_codes=bank_codes,
            account_type=account_type,
            bvn=bvn,
            nin=nin,
        )

        # Atomically lock-and-recheck before saving so two concurrent requests
        # that both raced past the fast-path read don't create duplicates.
        with transaction.atomic():
            if not force_new:
                existing = VirtualAccount.objects.select_for_update().filter(
                    user=user, provider="PAYVESSEL", is_active=True
                ).first()
                if existing:
                    return existing

            first_va: Optional[VirtualAccount] = None
            for acct in result.accounts:
                account_number = (acct.account_number or "").strip()
                if not account_number:
                    continue
                va, _created = VirtualAccount.objects.get_or_create(
                    account_number=account_number,
                    defaults={
                        "user": user,
                        "provider": "PAYVESSEL",
                        "account_name": (
                            acct.account_name
                            or getattr(user, "get_full_name", lambda: user.username)()
                            or user.username
                        ),
                        "bank_name": acct.bank_name or "PayVessel Partner Bank",
                        "metadata": {
                            "source": "payvessel",
                            "bank_code": acct.bank_code,
                            "account_type": acct.account_type,
                            "expire_date": acct.expire_date,
                            "tracking_reference": acct.tracking_reference,
                            "business": result.business,
                        },
                    },
                )
                if first_va is None:
                    first_va = va

        if not first_va:
            raise PaymentGatewayException(
                "PayVessel response did not contain any usable bank accounts."
            )

        return first_va

    @staticmethod
    def sync_payvessel_virtual_account(va: VirtualAccount) -> bool:
        """
        Refresh a stored PayVessel account from PayVessel (reconciliation).

        Returns False if PayVessel no longer knows the account (nothing is
        changed or deactivated automatically, so an operator can decide).
        """
        from integrations.payments import payvessel_va

        remote = payvessel_va.get_virtual_account(va.account_number)
        if remote is None:
            logger.warning("PayVessel has no record of virtual account %s", va.account_number)
            return False

        metadata = dict(va.metadata or {})
        metadata.update(
            {
                "bank_code": remote.bank_code or metadata.get("bank_code"),
                "account_type": remote.account_type or metadata.get("account_type"),
                "expire_date": remote.expire_date,
                "tracking_reference": remote.tracking_reference or metadata.get("tracking_reference"),
            }
        )
        va.metadata = metadata
        if remote.bank_name:
            va.bank_name = remote.bank_name
        if remote.account_name:
            va.account_name = remote.account_name
        va.save(update_fields=["metadata", "bank_name", "account_name", "updated_at"])
        return True

    @staticmethod
    def get_balance(user) -> Decimal:
        """Get user's wallet balance."""
        try:
            return user.wallet.balance
        except Wallet.DoesNotExist:
            return Decimal("0.00")

    @staticmethod
    @transaction.atomic
    def credit_wallet(
        wallet: Wallet,
        amount: Decimal,
        description: str,
        reference: Optional[str] = None,
        related_transaction=None,
    ) -> Ledger:
        """
        Credit money to a wallet.

        Args:
            wallet: Wallet to credit
            amount: Amount to credit
            description: Description of the transaction
            reference: Unique reference (generated if not provided)
            related_transaction: Related transaction instance

        Returns:
            Ledger entry

        Raises:
            ValueError: If amount is not positive
        """
        if amount <= Decimal("0.00"):
            raise ValueError("Credit amount must be positive")

        # Lock the wallet row for update
        wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)

        balance_before = wallet.balance
        wallet.balance += amount
        wallet.save()

        ref = reference or f"CR_{uuid.uuid4().hex[:12].upper()}"
        ledger = Ledger.objects.create(
            wallet=wallet,
            ledger_type=Ledger.LedgerType.CREDIT,
            amount=amount,
            balance_before=balance_before,
            balance_after=wallet.balance,
            description=description,
            reference=ref,
            related_transaction=related_transaction,
        )

        # Sync User.balance inside the atomic block so wallet + user commit together.
        _sync_user_balance(wallet)

        logger.info(
            "Wallet credited | wallet=%d user=%d amount=%s balance=%s ref=%s",
            wallet.pk, wallet.user_id, amount, wallet.balance, ref,
        )
        return ledger

    @staticmethod
    @transaction.atomic
    def credit_cashback(
        wallet: Wallet,
        amount: Decimal,
        description: str,
        reference: Optional[str] = None,
        related_transaction=None,
    ) -> Ledger:
        """
        Credit cashback into the wallet's dedicated cashback balance. Cashback
        accumulates separately from the regular wallet balance and can only be
        spent on airtime purchases (see debit_cashback_balance).
        """
        if amount <= Decimal("0.00"):
            raise ValueError("Credit amount must be positive")

        wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)

        balance_before = wallet.cashback_balance
        wallet.cashback_balance += amount
        wallet.save(update_fields=["cashback_balance", "updated_at"])

        ref = reference or f"CB_{uuid.uuid4().hex[:12].upper()}"
        ledger = Ledger.objects.create(
            wallet=wallet,
            ledger_type=Ledger.LedgerType.CREDIT,
            source=Ledger.BalanceSource.CASHBACK,
            amount=amount,
            balance_before=balance_before,
            balance_after=wallet.cashback_balance,
            description=f"Cashback: {description}",
            reference=ref,
            related_transaction=related_transaction,
        )

        logger.info(
            "Cashback credited | wallet=%d user=%d amount=%s cashback_balance=%s ref=%s",
            wallet.pk, wallet.user_id, amount, wallet.cashback_balance, ref,
        )
        return ledger

    @staticmethod
    @transaction.atomic
    def debit_cashback_balance(
        wallet: Wallet,
        amount: Decimal,
        description: str,
        reference: Optional[str] = None,
        related_transaction=None,
    ) -> Ledger:
        """
        Debit from the cashback balance only. Used to pay for airtime purchases
        with accumulated cashback.
        """
        if amount <= Decimal("0.00"):
            raise ValueError("Debit amount must be positive")

        wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)

        if wallet.cashback_balance < amount:
            raise InsufficientFundsException(
                f"Insufficient cashback balance. Available: ₦{wallet.cashback_balance}, "
                f"Requested: ₦{amount}"
            )

        balance_before = wallet.cashback_balance
        wallet.cashback_balance -= amount
        wallet.save(update_fields=["cashback_balance", "updated_at"])

        ref = reference or f"CBDR_{uuid.uuid4().hex[:12].upper()}"
        ledger = Ledger.objects.create(
            wallet=wallet,
            ledger_type=Ledger.LedgerType.DEBIT,
            source=Ledger.BalanceSource.CASHBACK,
            amount=amount,
            balance_before=balance_before,
            balance_after=wallet.cashback_balance,
            description=description,
            reference=ref,
            related_transaction=related_transaction,
        )

        logger.info(
            "Cashback debited | wallet=%d user=%d amount=%s cashback_balance=%s ref=%s",
            wallet.pk, wallet.user_id, amount, wallet.cashback_balance, ref,
        )
        return ledger

    @staticmethod
    @transaction.atomic
    def debit_wallet(
        wallet: Wallet,
        amount: Decimal,
        description: str,
        reference: Optional[str] = None,
        related_transaction=None,
        enforce_limits: bool = True,
    ) -> Ledger:
        """
        Debit money from a wallet.

        ``enforce_limits=False`` skips the user-facing per-transaction cap and
        minimum-balance rule (used for admin adjustments); the balance can still
        never go below zero.

        Args:
            wallet: Wallet to debit
            amount: Amount to debit
            description: Description of the transaction
            reference: Unique reference (generated if not provided)
            related_transaction: Related transaction instance

        Returns:
            Ledger entry

        Raises:
            InsufficientFundsException: If wallet has insufficient funds
            ValueError: If amount is not positive
        """
        if amount <= Decimal("0.00"):
            raise ValueError("Debit amount must be positive")

        max_amount = getattr(settings, "MAX_TRANSACTION_AMOUNT", None)
        if enforce_limits and max_amount is not None and amount > Decimal(str(max_amount)):
            from common.exceptions import AmountLimitExceededException
            raise AmountLimitExceededException(f"Amount {amount} exceeds maximum allowed per transaction ({max_amount}).")

        # Lock the wallet row for update
        wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)

        min_balance = (
            Decimal(str(getattr(settings, "MIN_WALLET_BALANCE", 0))) if enforce_limits else Decimal("0")
        )
        available_balance = wallet.balance - min_balance

        if available_balance < amount:
            logger.warning(
                "Insufficient funds | wallet=%d user=%d available=%s requested=%s",
                wallet.pk, wallet.user_id, available_balance, amount,
            )
            raise InsufficientFundsException(
                f"Insufficient funds. Available: ₦{available_balance}, Requested: ₦{amount}"
            )

        balance_before = wallet.balance
        wallet.balance -= amount
        wallet.save()

        ref = reference or f"DR_{uuid.uuid4().hex[:12].upper()}"
        ledger = Ledger.objects.create(
            wallet=wallet,
            ledger_type=Ledger.LedgerType.DEBIT,
            amount=amount,
            balance_before=balance_before,
            balance_after=wallet.balance,
            description=description,
            reference=ref,
            related_transaction=related_transaction,
        )

        # Sync User.balance inside the atomic block so wallet + user commit together.
        _sync_user_balance(wallet)

        logger.info(
            "Wallet debited | wallet=%d user=%d amount=%s balance=%s ref=%s",
            wallet.pk, wallet.user_id, amount, wallet.balance, ref,
        )
        return ledger

    @staticmethod
    def get_ledger_history(user, limit: int = 50, offset: int = 0) -> list[Ledger]:
        """Get wallet ledger history for a user."""
        try:
            wallet = user.wallet
        except Wallet.DoesNotExist:
            return []

        return list(
            Ledger.objects.filter(wallet=wallet)
            .select_related("related_transaction")
            .order_by("-created_at")[offset : offset + limit]
        )
