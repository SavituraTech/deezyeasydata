"""
Payment serializers for deposit flow.
"""
from decimal import Decimal
from rest_framework import serializers


class InitiateDepositSerializer(serializers.Serializer):
    """Validate initiate-deposit request (amount, optional callback_url)."""

    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.01"),
        help_text="Deposit amount",
    )
    callback_url = serializers.URLField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="URL to redirect after payment (e.g. frontend success page)",
    )
    provider = serializers.ChoiceField(
        choices=["payvessel"],
        required=False,
        allow_null=True,
        help_text="Payment gateway to use for this deposit (defaults to DEFAULT_PAYMENT_PROVIDER)",
    )

    def validate_amount(self, value):
        from django.conf import settings

        max_amount = Decimal(str(getattr(settings, "MAX_TRANSACTION_AMOUNT", 50000)))
        if value > max_amount:
            raise serializers.ValidationError(
                f"Amount exceeds maximum of {max_amount}"
            )
        return value
