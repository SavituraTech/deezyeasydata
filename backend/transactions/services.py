import logging
import uuid
from decimal import Decimal
from django.conf import settings
from django.db import transaction as db_transaction
from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import Transaction, TransactionStatus, TransactionType
from wallets.services import WalletService
from wallets.models import WalletConfig
from common.exceptions import InsufficientFundsException, InvalidTransactionStateException
from common.helpers import generate_reference, normalize_phone_number
from notifications.services import NotificationService

logger = logging.getLogger(__name__)

User = get_user_model()


def _generate_payment_reference(prefix: str = "PAY") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12].upper()}"


class TransactionService:
    """
    Service class for handling transaction lifecycle operations.
    """

    @staticmethod
    def mark_transaction_success(transaction: Transaction, reference: str = None) -> None:
        with db_transaction.atomic():
            if transaction.status != TransactionStatus.PENDING:
                raise InvalidTransactionStateException(f"Cannot mark SUCCESS; status is {transaction.status}")
            transaction.status = TransactionStatus.SUCCESS
            if reference:
                transaction.provider_reference = reference
            transaction.save(update_fields=["status", "provider_reference", "updated_at"])
            logger.info("Transaction marked SUCCESS | txn=%d ref=%s", transaction.id, reference)

    @staticmethod
    def mark_transaction_failed(
        transaction: Transaction, error_code: str = None, error_message: str = None
    ) -> None:
        with db_transaction.atomic():
            if transaction.status not in [TransactionStatus.PENDING]:
                raise InvalidTransactionStateException(f"Cannot mark FAILED; status is {transaction.status}")
            transaction.status = TransactionStatus.FAILED
            transaction.error_code = error_code
            transaction.error_message = error_message
            transaction.provider_response = {
                "error_code": error_code,
                "error_message": error_message,
            }
            transaction.save(update_fields=["status", "error_code", "error_message", "provider_response", "updated_at"])
            logger.info("Transaction marked FAILED | txn=%d code=%s", transaction.id, error_code)

    @staticmethod
    def refund_transaction(transaction: Transaction) -> None:
        with db_transaction.atomic():
            wallet = WalletService.get_or_create_wallet(transaction.user)
            refund_ref = f"REFUND_{uuid.uuid4().hex[:12].upper()}"
            WalletService.credit_wallet(
                wallet,
                transaction.amount,
                description=f"Refund for transaction {transaction.id}",
                reference=refund_ref,
                related_transaction=transaction,
            )

            transaction.is_refunded = True
            transaction.refunded_at = timezone.now()
            transaction.refund_reference = refund_ref
            transaction.provider_response = {
                **(transaction.provider_response or {}),
                "refunded": True,
                "refund_amount": str(transaction.amount),
            }
            transaction.save(update_fields=[
                "is_refunded", "refunded_at", "refund_reference",
                "provider_response", "updated_at",
            ])

            logger.info(
                "Refund credited | txn=%d user=%d amount=%s ref=%s",
                transaction.id, transaction.user_id, transaction.amount, refund_ref,
            )

            try:
                NotificationService.notify_refund(transaction.user, transaction)
            except Exception:
                logger.exception("Failed to send refund notification | txn=%d user=%d", transaction.id, transaction.user_id)

    @staticmethod
    def create_deposit_transaction(
        user: User,
        amount: Decimal,
        payment_reference: str,
        provider: str = "PAYVESSEL",
    ) -> Transaction:
        return Transaction.objects.create(
            user=user,
            amount=amount,
            type=TransactionType.DEPOSIT,
            status=TransactionStatus.PENDING,
            target="deposit",
            internal_reference=generate_reference("DEP"),
            provider_reference=payment_reference,
            provider=provider,
        )

    @staticmethod
    @db_transaction.atomic
    def create_purchase_transaction(user, product, phone: str, transaction_type: str) -> Transaction:
        normalized = normalize_phone_number(phone) if phone else phone
        # fallback if helper missing
        if normalized is None and phone:
            from common.helpers import normalize_phone
            normalized = normalize_phone(phone)
        return Transaction.objects.create(
            user=user,
            product=product,
            amount=product.selling_price,
            phone=normalized,
            target=normalized or phone,
            type=transaction_type,
            status=TransactionStatus.PENDING,
            internal_reference=generate_reference("TXN"),
        )

    @staticmethod
    @db_transaction.atomic
    def apply_purchase_cashback(txn: Transaction) -> Decimal:
        if txn.cashback_applied or not txn.product or txn.type not in (TransactionType.AIRTIME, TransactionType.DATA):
            return Decimal("0.00")
        if txn.payment_source == Transaction.PAYMENT_SOURCE_CASHBACK:
            return Decimal("0.00")
        config = WalletConfig.get_solo()
        # prefer per-product cashback_percent, then legacy cashback_rate_percent, then platform default
        rate = None
        if getattr(txn.product, "cashback_percent", None) not in (None, Decimal("0.00")):
            rate = Decimal(str(txn.product.cashback_percent))
        elif getattr(txn.product, "cashback_rate_percent", None) not in (None,):
            rate = Decimal(str(txn.product.cashback_rate_percent))
        else:
            cat_rates = getattr(config, "cashback_rate_by_category", None) or {}
            rate = Decimal(str(cat_rates.get(txn.product.category, "0.00")))
        if not rate or rate <= Decimal("0.00"):
            return Decimal("0.00")
        cashback_amount = (txn.amount * rate / Decimal("100")).quantize(Decimal("0.01"))
        if cashback_amount <= Decimal("0.00"):
            return Decimal("0.00")
        # cap at margin
        margin = getattr(txn.product, "margin", None)
        if margin is not None and cashback_amount > margin:
            cashback_amount = margin
        min_cashback = Decimal(str(getattr(settings, "MIN_CASHBACK_AMOUNT", "1.00")))
        if cashback_amount < min_cashback:
            return Decimal("0.00")
        # atomic double-check
        fresh = Transaction.objects.select_for_update().get(pk=txn.pk)
        if fresh.cashback_applied:
            return Decimal("0.00")
        wallet = WalletService.get_or_create_wallet(txn.user)
        ref = f"CASHBACK_{fresh.internal_reference or fresh.id}"
        WalletService.credit_cashback(wallet, cashback_amount, description=f"Cashback for {txn.type} - {fresh.internal_reference}", reference=ref, related_transaction=fresh)
        fresh.cashback_amount = cashback_amount
        fresh.cashback_reference = ref
        fresh.cashback_applied = True
        fresh.cashback_applied_at = timezone.now()
        fresh.save(update_fields=["cashback_amount", "cashback_reference", "cashback_applied", "cashback_applied_at", "updated_at"])
        return cashback_amount

    @staticmethod
    @db_transaction.atomic
    def complete_deposit_transaction(txn: Transaction) -> Transaction:
        # select_for_update() prevents two concurrent webhook deliveries from
        # both reading status=PENDING and double-crediting the wallet.
        txn = Transaction.objects.select_for_update().get(pk=txn.pk)
        if txn.type != TransactionType.DEPOSIT:
            raise ValueError("Transaction is not a deposit")
        if txn.status == TransactionStatus.SUCCESS:
            return txn
        if txn.status != TransactionStatus.PENDING:
            raise ValueError(f"Cannot complete deposit; status is {txn.status}")

        wallet = WalletService.get_or_create_wallet(txn.user)
        WalletService.credit_wallet(
            wallet,
            txn.amount,
            description=f"Wallet deposit - ref {txn.provider_reference}",
            reference=f"DEP_{uuid.uuid4().hex[:12].upper()}",
            related_transaction=txn,
        )

        config = WalletConfig.get_solo()

        # Deduct funding charge (debit_wallet re-fetches wallet so it sees the post-credit balance)
        funding_charge = Decimal(str(config.funding_charge or 0))
        if funding_charge > Decimal("0.00"):
            try:
                with db_transaction.atomic():
                    WalletService.debit_wallet(
                        wallet,
                        funding_charge,
                        description=f"Funding charge - ref {txn.provider_reference}",
                        reference=f"FC_{uuid.uuid4().hex[:12].upper()}",
                        related_transaction=txn,
                    )
                txn.provider_response = {
                    **(txn.provider_response or {}),
                    "funding_charge": str(funding_charge),
                }
            except InsufficientFundsException:
                # Deposit too small to cover the charge — credit stands, charge skipped
                logger.warning(
                    "Funding charge skipped — deposit too small | txn=%d charge=%s amount=%s",
                    txn.id, funding_charge, txn.amount,
                )

        cashback_rate = Decimal(str(config.cashback_rate_percent or 0))
        cashback_amount = (txn.amount * cashback_rate / Decimal("100")).quantize(Decimal("0.01"))
        if cashback_amount > Decimal("0.00"):
            WalletService.credit_cashback(
                wallet,
                cashback_amount,
                description=f"Deposit ({cashback_rate}%) - ref {txn.provider_reference}",
                reference=f"CASH_{uuid.uuid4().hex[:12].upper()}",
                related_transaction=txn,
            )
            txn.provider_response = {
                **(txn.provider_response or {}),
                "cashback_rate_percent": str(cashback_rate),
                "cashback_amount": str(cashback_amount),
            }

        txn.status = TransactionStatus.SUCCESS
        update_fields = ["status", "updated_at"]
        if txn.provider_response is not None:
            update_fields.append("provider_response")
        txn.save(update_fields=update_fields)
        logger.info("Deposit completed | txn=%d user=%d amount=%s", txn.id, txn.user_id, txn.amount)

        try:
            NotificationService.notify_deposit_success(txn.user, txn)
        except Exception:
            logger.exception("Failed to send deposit notification | txn=%d user=%d", txn.id, txn.user_id)

        return txn
