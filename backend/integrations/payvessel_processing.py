"""
PayVessel webhook processing.

``process_result`` holds the business logic and returns an ``Outcome`` (an HTTP
status + body). It is used inline (PAYVESSEL_WEBHOOK_ASYNC=False) or from the
background worker (``process_event``) for events stored in ``WebhookEvent``.
Status >= 500 means "retry".
"""
import logging
import threading
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, close_old_connections, connection
from django.db import transaction as db_transaction
from django.utils import timezone

from .models import WebhookEvent

logger = logging.getLogger(__name__)

SUCCESS_STATUSES = {"paid", "success", "successful", "completed", "approved"}
# Events for other products (transfers, KYC, cards, ...) never touch deposits.
IGNORED_EVENT_PREFIXES = ("transfer.", "verification.", "account.", "card.", "virtual_card.")
STALE_PROCESSING_AFTER = timedelta(minutes=5)


@dataclass
class Outcome:
    status_code: int
    body: dict

    @property
    def retry(self) -> bool:
        return self.status_code >= 500


def is_ignored_event(event: str) -> bool:
    return (event or "").lower().startswith(IGNORED_EVENT_PREFIXES)


def _ok(message: str) -> Outcome:
    return Outcome(200, {"success": True, "message": message})


def _retry(message: str) -> Outcome:
    """Roll back anything done in the current atomic block and ask for a retry."""
    if connection.in_atomic_block:
        db_transaction.set_rollback(True)
    return Outcome(503, {"error": message})


def _decimal(value):
    """Return a finite Decimal, or None for missing/malformed provider values."""
    if value is None or isinstance(value, bool):
        return None
    try:
        parsed = Decimal(str(value))
    except (ValueError, TypeError, ArithmeticError):
        return None
    return parsed if parsed.is_finite() else None


def process_result(result) -> Outcome:
    """Apply a verified, parsed PayVessel webhook (``WebhookResult``) to deposits."""
    from integrations.payments.client import get_client
    from transactions.models import Transaction, TransactionType
    from transactions.services import TransactionService

    client = get_client("payvessel")
    payment_reference = result.payment_reference
    if not payment_reference:
        return Outcome(400, {"error": "Missing payment reference in webhook"})

    is_success = (result.status or "").strip().lower() in SUCCESS_STATUSES

    deposits = Transaction.objects.filter(
        type=TransactionType.DEPOSIT, provider_reference=payment_reference
    )

    # Confirm with PayVessel before moving money. Done before taking row locks
    # so the HTTP call never holds a lock.
    verified_amount = None
    should_verify = (
        is_success
        and getattr(settings, "PAYVESSEL_VERIFY_BEFORE_CREDIT", True)
        and (
            deposits.exists()
            or getattr(settings, "PAYVESSEL_VERIFY_VA_CREDITS", False)
        )
        and not deposits.filter(status="SUCCESS").exists()
    )
    if should_verify:
        verification = client.verify_payment(payment_reference, timeout=8)
        vstatus = (verification.status or "").strip().lower()
        if verification.success:
            verified_amount = _decimal(verification.amount)
            if verified_amount is None or verified_amount <= 0:
                logger.error(
                    "PayVessel verification omitted a valid amount for %s", payment_reference
                )
                return Outcome(503, {"error": "Payment verification amount is unavailable"})
            verified_reference = str(verification.payment_reference or "").strip()
            if verified_reference and verified_reference != payment_reference:
                logger.error(
                    "PayVessel verification reference mismatch: expected=%s returned=%s",
                    payment_reference,
                    verified_reference,
                )
                return Outcome(409, {"error": "Payment verification reference mismatch"})
            expected_currency = str(getattr(settings, "PAYVESSEL_CURRENCY", "NGN")).upper()
            verified_currency = str(verification.currency or "").strip().upper()
            if verified_currency and verified_currency != expected_currency:
                logger.error(
                    "PayVessel verification currency mismatch for %s: expected=%s returned=%s",
                    payment_reference,
                    expected_currency,
                    verified_currency,
                )
                return Outcome(409, {"error": "Payment verification currency mismatch"})
        elif vstatus in ("pending", ""):
            # Unknown/pending (or lookup failed): fail closed, retry later.
            logger.warning("PayVessel verify not conclusive for %s: %s", payment_reference, vstatus)
            return Outcome(503, {"error": "Payment not yet confirmed"})
        else:
            logger.error(
                "PayVessel webhook claimed success but verify says %s for %s",
                vstatus, payment_reference,
            )
            is_success = False

    with db_transaction.atomic():
        if deposits.select_for_update().filter(status="SUCCESS").exists():
            logger.info("PayVessel webhook already processed: %s", payment_reference)
            return _ok("Already processed")

        txn = deposits.select_for_update().exclude(status="SUCCESS").first()

        if not is_success:
            # Failures only update an existing pending deposit; they never create one.
            if txn and txn.status == "PENDING":
                TransactionService.mark_transaction_failed(
                    txn,
                    error_code="PAYMENT_FAILED",
                    error_message=result.message or "PayVessel payment failed",
                )
                logger.info("Deposit failed via PayVessel webhook: txn %s", txn.id)
            return _ok("Failure recorded")

        credit_amount = result.amount
        if (
            getattr(settings, "PAYVESSEL_CREDIT_SETTLEMENT_AMOUNT", False)
            and result.settlement_amount is not None
        ):
            credit_amount = result.settlement_amount

        if txn:
            # A verified success supersedes an earlier failure callback. Restore
            # the checkout to PENDING so the normal atomic completion path can run.
            if txn.status == "FAILED":
                txn.status = "PENDING"
                txn.error_code = None
                txn.error_message = None
                txn.save(update_fields=["status", "error_code", "error_message", "updated_at"])

            # Checkout deposit: the amount paid must match what we asked for.
            amount_to_compare = verified_amount
            if amount_to_compare is None and getattr(
                settings, "PAYVESSEL_VERIFY_BEFORE_CREDIT", True
            ):
                return _retry("Verified payment amount is unavailable")
            if amount_to_compare is not None and abs(amount_to_compare - txn.amount) > Decimal("0.01"):
                logger.error(
                    "PayVessel amount mismatch for %s: verified=%s expected=%s",
                    payment_reference, verified_amount, txn.amount,
                )
                txn.error_code = "PAYMENT_AMOUNT_MISMATCH"
                txn.error_message = (
                    f"PayVessel verified {amount_to_compare}; expected {txn.amount}"
                )
                txn.provider_response = {
                    **(txn.provider_response or {}),
                    "review_required": True,
                    "verified_amount": str(amount_to_compare),
                    "expected_amount": str(txn.amount),
                }
                txn.save(
                    update_fields=[
                        "error_code", "error_message", "provider_response", "updated_at"
                    ]
                )
                return Outcome(409, {"error": "Payment amount mismatch; manual review required"})
        else:
            # Reserved-account bank transfer: locate the owner by receiver account.
            account_number = result.receiver_account_number
            tracking_reference = result.tracking_reference
            if not account_number and not tracking_reference:
                logger.error("PayVessel webhook: no pending deposit or receiver for %s", payment_reference)
                return _ok("Transaction not found")

            from wallets.models import VirtualAccount

            va = None
            if account_number:
                va = (
                    VirtualAccount.objects.select_for_update()
                    .filter(
                        provider="PAYVESSEL",
                        account_number=account_number,
                        is_active=True,
                    )
                    .first()
                )
            if va is None and tracking_reference:
                # Payload carried no (matching) account number: fall back to the
                # tracking reference PayVessel returned when the account was created.
                va = (
                    VirtualAccount.objects.select_for_update()
                    .filter(
                        provider="PAYVESSEL",
                        metadata__tracking_reference=tracking_reference,
                        is_active=True,
                    )
                    .first()
                )
            if not va:
                # 200 so PayVessel/our worker stop retrying; the error log is the alert.
                logger.error(
                    "PayVessel webhook: virtual account not found for receiver %s (ref %s)",
                    account_number or tracking_reference, payment_reference,
                )
                return _ok("Virtual account not found; logged for review")
            if credit_amount is None:
                logger.error("PayVessel webhook missing amount for %s", payment_reference)
                return Outcome(400, {"error": "Amount not found in webhook"})
            credit_amount = _decimal(credit_amount)
            if credit_amount is None or credit_amount <= 0:
                return Outcome(400, {"error": "A valid positive amount is required"})

            # The VA row lock serializes payments targeting this account. Recheck
            # the reference after acquiring it because another callback may have
            # created the deposit while this worker was waiting.
            txn = (
                Transaction.objects.select_for_update()
                .filter(type=TransactionType.DEPOSIT, provider_reference=payment_reference)
                .first()
            )
            if txn and txn.status == "SUCCESS":
                return _ok("Already processed")
            if txn is None:
                try:
                    # A nested atomic block gives IntegrityError its own savepoint,
                    # keeping the outer transaction usable for the winning lookup.
                    with db_transaction.atomic():
                        txn = TransactionService.create_deposit_transaction(
                            user=va.user,
                            amount=credit_amount,
                            payment_reference=payment_reference,
                            provider="PAYVESSEL",
                        )
                except IntegrityError:
                    # Database uniqueness is the final guard across different
                    # accounts/workers and databases where row-lock timing differs.
                    txn = Transaction.objects.select_for_update().get(
                        type=TransactionType.DEPOSIT,
                        provider_reference=payment_reference,
                    )
                    if txn.status == "SUCCESS":
                        return _ok("Already processed")

        try:
            TransactionService.complete_deposit_transaction(txn)
        except Exception as e:
            logger.exception("PayVessel complete deposit failed: %s", e)
            return _retry("Deposit processing failed")

        logger.info("Deposit completed via PayVessel webhook: txn %s", txn.id)
        return _ok("Deposit processed")


# --------------------------------------------------------------------------- #
# Background processing
# --------------------------------------------------------------------------- #

def _max_attempts() -> int:
    return int(getattr(settings, "PAYVESSEL_WEBHOOK_MAX_ATTEMPTS", 8))


def _backoff(attempts: int) -> timedelta:
    return timedelta(seconds=min(30 * (2 ** (attempts - 1)), 3600))


def store_event(result, payload: dict):
    """Persist a verified webhook. Returns ``(event, created)``."""
    key = f"payvessel:{(result.event or '').lower()}:{result.payment_reference}"
    return WebhookEvent.objects.get_or_create(
        dedupe_key=key,
        defaults={
            "provider": "payvessel",
            "event": result.event or "",
            "reference": result.payment_reference,
            "payload": payload,
        },
    )


def process_event(event_id: int) -> Outcome | None:
    """Process one stored event. Returns None if another worker holds it."""
    from integrations.payments.client import get_client

    claimed = WebhookEvent.objects.filter(
        pk=event_id, status=WebhookEvent.Status.RECEIVED, next_attempt_at__lte=timezone.now()
    ).update(status=WebhookEvent.Status.PROCESSING, updated_at=timezone.now())
    if not claimed:
        return None

    event = WebhookEvent.objects.get(pk=event_id)
    try:
        result = get_client("payvessel").parse_webhook(event.payload)
        outcome = process_result(result)
    except Exception as exc:  # never lose the event on an unexpected error
        logger.exception("PayVessel webhook event %s crashed", event_id)
        outcome = Outcome(500, {"error": str(exc)})

    event.attempts += 1
    event.response_code = outcome.status_code
    if outcome.retry and event.attempts < _max_attempts():
        event.status = WebhookEvent.Status.RECEIVED
        event.next_attempt_at = timezone.now() + _backoff(event.attempts)
        event.last_error = str(outcome.body)
    elif outcome.retry or outcome.status_code >= 400:
        event.status = WebhookEvent.Status.FAILED
        event.last_error = str(outcome.body)
        event.processed_at = timezone.now()
        logger.error(
            "PayVessel webhook event %s FAILED after %d attempt(s): %s",
            event_id, event.attempts, outcome.body,
        )
    else:
        event.status = WebhookEvent.Status.PROCESSED
        event.last_error = ""
        event.processed_at = timezone.now()
    event.save()
    return outcome


def dispatch(event_id: int) -> None:
    """Process ``event_id`` on a background thread once the current transaction commits."""

    def _run():
        try:
            process_event(event_id)
        except Exception:
            logger.exception("PayVessel background processing failed for event %s", event_id)
        finally:
            close_old_connections()

    def _start():
        threading.Thread(target=_run, name=f"payvessel-webhook-{event_id}", daemon=True).start()

    db_transaction.on_commit(_start)


def process_due_events(limit: int = 100, include_failed: bool = False) -> int:
    """Process events that are due for (re)processing. Used by the management command."""
    now = timezone.now()
    # Recover events whose worker died mid-processing.
    WebhookEvent.objects.filter(
        status=WebhookEvent.Status.PROCESSING, updated_at__lt=now - STALE_PROCESSING_AFTER
    ).update(status=WebhookEvent.Status.RECEIVED, next_attempt_at=now)
    if include_failed:
        WebhookEvent.objects.filter(provider="payvessel", status=WebhookEvent.Status.FAILED).update(
            status=WebhookEvent.Status.RECEIVED, attempts=0, next_attempt_at=now
        )
    ids = list(
        WebhookEvent.objects.filter(
            provider="payvessel", status=WebhookEvent.Status.RECEIVED, next_attempt_at__lte=now
        )
        .order_by("next_attempt_at")
        .values_list("pk", flat=True)[:limit]
    )
    handled = 0
    for pk in ids:
        if process_event(pk) is not None:
            handled += 1
    return handled
