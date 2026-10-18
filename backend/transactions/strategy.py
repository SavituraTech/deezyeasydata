import logging
from decimal import Decimal
from typing import Dict, Any
from django.db import transaction
from .models import Transaction, TransactionStatus
from providers.adapter import ProviderAdapter
from providers.exceptions import ProviderFailedException, ProviderTimeoutException
from wallets.services import WalletService
from common.exceptions import InsufficientFundsException
from notifications.services import NotificationService

logger = logging.getLogger(__name__)


class InsufficientFundsError(Exception):
    pass


class VendingStrategy:
    """
    Coordinates the transaction lifecycle:
    1. Creates pending transaction (committed immediately).
    2. Debits user wallet atomically; marks FAILED and returns if insufficient funds.
    3. Calls ProviderAdapter outside any DB transaction.
    4. Handles failure (refunds) or success — each outcome saved atomically.
    """
    def __init__(self, adapter: ProviderAdapter):
        self.adapter = adapter

    def process_vend(
        self,
        user,
        amount: float,
        vend_type: str,
        target: str,
        provider_payload: Dict[str, Any],
        funding_source: str = "WALLET",
    ) -> Transaction:
        amount_decimal = Decimal(str(amount))

        # 1. Persist the pending transaction first so it is always visible, regardless
        #    of what happens next (provider call, worker kill, etc.).
        txn = Transaction.objects.create(
            user=user,
            amount=amount_decimal,
            type=vend_type,
            status=TransactionStatus.PENDING,
            target=target,
            provider_request=provider_payload,
        )

        # 2. Debit wallet (or cashback balance, for cashback-funded airtime purchases).
        #    If funds are insufficient, mark FAILED and bail — no provider call is
        #    made, so no refund is needed.
        try:
            with transaction.atomic():
                wallet = WalletService.get_or_create_wallet(user)
                if funding_source == "CASHBACK":
                    WalletService.debit_cashback_balance(
                        wallet,
                        amount_decimal,
                        description=f"Vend (cashback): {vend_type} - {target}",
                        related_transaction=txn,
                    )
                else:
                    WalletService.debit_wallet(
                        wallet,
                        amount_decimal,
                        description=f"Vend: {vend_type} - {target}",
                        related_transaction=txn,
                    )
        except InsufficientFundsException as e:
            txn.status = TransactionStatus.FAILED
            txn.provider_response = {"error": str(e)}
            txn.save(update_fields=["status", "provider_response", "updated_at"])
            raise InsufficientFundsError(str(e))

        # 3. Call provider outside any DB transaction so connections aren't held open
        #    during a potentially slow network call.
        logger.info(
            "Vend started | txn=%d user=%d type=%s amount=%s",
            txn.id, user.pk, vend_type, amount_decimal,
        )
        try:
            result = self.adapter.execute_vend(provider_payload)
        except ProviderTimeoutException as e:
            # Do NOT refund on timeout — the provider may have already processed it.
            logger.error(
                "Provider timeout | txn=%d user=%d type=%s amount=%s | %s",
                txn.id, user.pk, vend_type, amount_decimal, e,
            )
            txn.provider_response = {"error": "Timeout", "message": str(e)}
            txn.save(update_fields=["provider_response", "updated_at"])
            raise
        except ProviderFailedException as e:
            logger.error(
                "Provider failed | txn=%d user=%d type=%s amount=%s | %s",
                txn.id, user.pk, vend_type, amount_decimal, e,
            )
            self._fail_and_refund(txn, user, amount_decimal, vend_type, str(e), funding_source)
            raise
        except Exception:
            logger.exception(
                "Unexpected error during vend | txn=%d user=%d type=%s amount=%s",
                txn.id, user.pk, vend_type, amount_decimal,
            )
            self._fail_and_refund(txn, user, amount_decimal, vend_type, "Unexpected exception", funding_source)
            raise

        # 4. Success — persist atomically so status + provider ref land together.
        with transaction.atomic():
            txn.status = TransactionStatus.SUCCESS
            txn.provider_reference = result.provider_ref
            txn.provider_response = result.raw
            txn.save(update_fields=["status", "provider_reference", "provider_response", "updated_at"])

        logger.info(
            "Vend successful | txn=%d user=%d type=%s amount=%s provider_ref=%s",
            txn.id, user.pk, vend_type, amount_decimal, result.provider_ref,
        )

        try:
            NotificationService.notify_vend_success(user, txn)
        except Exception:
            logger.exception("Failed to send success notification | txn=%d user=%d", txn.id, user.pk)

        return txn

    def _fail_and_refund(
        self,
        txn: Transaction,
        user,
        amount_decimal: Decimal,
        vend_type: str,
        error_msg: str,
        funding_source: str = "WALLET",
    ) -> None:
        """Mark the transaction FAILED and credit the refund atomically."""
        with transaction.atomic():
            txn.status = TransactionStatus.FAILED
            txn.provider_response = {"error": error_msg}
            txn.is_refunded = True
            txn.save(update_fields=["status", "provider_response", "is_refunded", "updated_at"])

            wallet = WalletService.get_or_create_wallet(user)
            if funding_source == "CASHBACK":
                WalletService.credit_cashback(
                    wallet,
                    amount_decimal,
                    description=f"Refund: vend failed - {vend_type}",
                    related_transaction=txn,
                )
            else:
                WalletService.credit_wallet(
                    wallet,
                    amount_decimal,
                    description=f"Refund: vend failed - {vend_type}",
                    related_transaction=txn,
                )

        logger.info(
            "Vend refunded | txn=%d user=%d type=%s amount=%s",
            txn.id, user.pk, vend_type, amount_decimal,
        )

        try:
            NotificationService.notify_vend_failed(user, txn)
        except Exception:
            logger.exception("Failed to send failure notification | txn=%d user=%d", txn.id, user.pk)
