"""
Manual admin credit/debit of user wallets.

Every operation is recorded in ``AdminWalletAdjustment`` (who, why, outcome) and
linked to the resulting ``Ledger`` entry. Safeguards: idempotency keys, no
self-adjustment, per-operation and daily-credit limits, and second-admin approval
above a threshold.
"""
import logging
from decimal import Decimal
from typing import Optional, Tuple

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from .models import AdminWalletAdjustment as Adjustment
from .services import WalletService

logger = logging.getLogger(__name__)
User = get_user_model()


class AdjustmentConflict(APIException):
    status_code = 409
    default_detail = "Idempotency key was already used for a different operation."
    default_code = "idempotency_conflict"


def _int_setting(name: str, default: int) -> int:
    return int(getattr(settings, name, default))


def _audit(adj: Adjustment, action: str, actor, note: str = "") -> None:
    """Mirror the event into the shared admin audit log (shown on the Audit Log screen)."""
    from transactions.models import AdminAuditLog

    AdminAuditLog.objects.create(
        admin=actor,
        action=action,
        target_user=adj.user,
        note=note or adj.reason,
        metadata={
            "adjustment_id": adj.pk,
            "amount": str(adj.amount),
            "source": adj.source,
            "requested_by": adj.admin_id,
            "reference": adj.ledger.reference if adj.ledger_id else None,
        },
    )


def _apply(adj: Adjustment) -> Adjustment:
    """Move the money for ``adj`` (must run inside a transaction)."""
    wallet = WalletService.get_or_create_wallet(adj.user)
    verb = "credit" if adj.adjustment_type == Adjustment.Type.CREDIT else "debit"
    description = f"Admin {verb}: {adj.reason}"[:230]
    reference = f"ADMADJ_{adj.pk}"

    if adj.source == Adjustment.Source.CASHBACK:
        fn = (
            WalletService.credit_cashback
            if verb == "credit"
            else WalletService.debit_cashback_balance
        )
        ledger = fn(wallet, adj.amount, description, reference=reference)
    elif verb == "credit":
        ledger = WalletService.credit_wallet(wallet, adj.amount, description, reference=reference)
    else:
        ledger = WalletService.debit_wallet(
            wallet, adj.amount, description, reference=reference, enforce_limits=False
        )

    adj.ledger = ledger
    adj.balance_before = ledger.balance_before
    adj.balance_after = ledger.balance_after
    adj.status = Adjustment.Status.APPLIED
    adj.save(update_fields=["ledger", "balance_before", "balance_after", "status"])
    _audit(
        adj,
        "WALLET_CREDIT" if verb == "credit" else "WALLET_DEBIT",
        adj.approved_by or adj.admin,
    )
    logger.info(
        "Admin adjustment applied | id=%s admin=%s user=%s %s %s %s ref=%s",
        adj.pk, adj.admin_id, adj.user_id, adj.adjustment_type, adj.source, adj.amount, reference,
    )
    return adj


def adjust(
    *,
    admin,
    user,
    adjustment_type: str,
    amount: Decimal,
    reason: str,
    source: str = Adjustment.Source.WALLET,
    idempotency_key: str,
    ip_address: Optional[str] = None,
) -> Tuple[Adjustment, bool]:
    """Returns ``(adjustment, replayed)``. ``replayed`` is True for a repeated idempotency key."""
    existing = Adjustment.objects.filter(admin=admin, idempotency_key=idempotency_key).first()
    if existing:
        return _check_replay(existing, user, adjustment_type, source, amount), True

    if admin.pk == user.pk:
        raise PermissionDenied("Admins cannot adjust their own wallet.")

    max_amount = _int_setting("ADMIN_MAX_ADJUSTMENT_AMOUNT", 1_000_000)
    if max_amount and amount > Decimal(max_amount):
        raise ValidationError({"amount": f"Exceeds the maximum admin adjustment of ₦{max_amount}."})

    try:
        with transaction.atomic():
            # Serialise this admin's operations so the daily limit can't be raced.
            User.objects.select_for_update().get(pk=admin.pk)

            if adjustment_type == Adjustment.Type.CREDIT:
                daily_limit = _int_setting("ADMIN_DAILY_CREDIT_LIMIT", 2_000_000)
                if daily_limit:
                    start = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)
                    used = (
                        Adjustment.objects.filter(
                            admin=admin,
                            adjustment_type=Adjustment.Type.CREDIT,
                            created_at__gte=start,
                        )
                        .exclude(status=Adjustment.Status.REJECTED)
                        .aggregate(t=Sum("amount"))["t"]
                        or Decimal("0")
                    )
                    if used + amount > Decimal(daily_limit):
                        raise ValidationError(
                            {"amount": f"Daily admin credit limit of ₦{daily_limit} would be exceeded (used ₦{used})."}
                        )

            adj = Adjustment.objects.create(
                admin=admin,
                user=user,
                adjustment_type=adjustment_type,
                source=source,
                amount=amount,
                reason=reason,
                idempotency_key=idempotency_key,
                ip_address=ip_address,
            )
            threshold = _int_setting("ADMIN_ADJUSTMENT_APPROVAL_THRESHOLD", 100_000)
            if threshold and amount >= Decimal(threshold):
                logger.info("Admin adjustment %s awaiting approval (₦%s)", adj.pk, amount)
                return adj, False
            return _apply(adj), False
    except IntegrityError:
        # Concurrent request with the same key won the race.
        existing = Adjustment.objects.get(admin=admin, idempotency_key=idempotency_key)
        return _check_replay(existing, user, adjustment_type, source, amount), True


def _check_replay(existing, user, adjustment_type, source, amount) -> Adjustment:
    if (
        existing.user_id != user.pk
        or existing.adjustment_type != adjustment_type
        or existing.source != source
        or existing.amount != amount
    ):
        raise AdjustmentConflict()
    return existing


def approve(adj_id: int, approver) -> Adjustment:
    with transaction.atomic():
        adj = Adjustment.objects.select_for_update().get(pk=adj_id)
        if adj.status != Adjustment.Status.PENDING_APPROVAL:
            raise ValidationError({"detail": f"Adjustment is {adj.status}, not pending."})
        if adj.admin_id == approver.pk:
            raise PermissionDenied("A different admin must approve this adjustment.")
        adj.approved_by = approver
        adj.decided_at = timezone.now()
        adj.save(update_fields=["approved_by", "decided_at"])
        return _apply(adj)


def reject(adj_id: int, actor) -> Adjustment:
    """Any admin (including the requester, as a cancel) may reject a pending adjustment."""
    with transaction.atomic():
        adj = Adjustment.objects.select_for_update().get(pk=adj_id)
        if adj.status != Adjustment.Status.PENDING_APPROVAL:
            raise ValidationError({"detail": f"Adjustment is {adj.status}, not pending."})
        adj.status = Adjustment.Status.REJECTED
        adj.approved_by = actor
        adj.decided_at = timezone.now()
        adj.save(update_fields=["status", "approved_by", "decided_at"])
        _audit(adj, "ADJUSTMENT_REJECTED", actor, note=f"Rejected: {adj.reason}")
        return adj
