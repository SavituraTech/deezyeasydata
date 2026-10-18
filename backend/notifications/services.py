import logging
from .models import Notification

logger = logging.getLogger(__name__)


class NotificationService:
    """Creates in-app notifications for key events."""

    @staticmethod
    def create_notification(user, title, message, metadata=None):
        return Notification.objects.create(
            user=user,
            title=title,
            message=message,
            metadata=metadata or {},
        )

    @staticmethod
    def notify_vend_success(user, transaction):
        NotificationService.create_notification(
            user=user,
            title="Transaction Successful",
            message=(
                f"Your {transaction.type} purchase of ₦{transaction.amount:,.2f} "
                f"to {transaction.target} was successful."
            ),
            metadata={
                "transaction_id": transaction.id,
                "type": transaction.type,
                "amount": str(transaction.amount),
            },
        )

    @staticmethod
    def notify_vend_failed(user, transaction):
        NotificationService.create_notification(
            user=user,
            title="Transaction Failed",
            message=(
                f"Your {transaction.type} purchase of ₦{transaction.amount:,.2f} "
                f"to {transaction.target} failed. Your wallet has been refunded."
            ),
            metadata={
                "transaction_id": transaction.id,
                "type": transaction.type,
                "amount": str(transaction.amount),
            },
        )

    @staticmethod
    def notify_deposit_success(user, transaction):
        NotificationService.create_notification(
            user=user,
            title="Wallet Funded",
            message=f"Your wallet has been credited with ₦{transaction.amount:,.2f}.",
            metadata={
                "transaction_id": transaction.id,
                "amount": str(transaction.amount),
            },
        )

    @staticmethod
    def notify_refund(user, transaction):
        NotificationService.create_notification(
            user=user,
            title="Refund Processed",
            message=(
                f"₦{transaction.amount:,.2f} has been refunded to your wallet "
                f"for transaction #{transaction.id}."
            ),
            metadata={
                "transaction_id": transaction.id,
                "amount": str(transaction.amount),
            },
        )
