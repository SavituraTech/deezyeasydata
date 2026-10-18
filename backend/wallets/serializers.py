from decimal import Decimal

from rest_framework import serializers

from .models import Ledger, PlatformKYC, VirtualAccount, Wallet, WalletConfig


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = ["id", "balance", "cashback_balance", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class LedgerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ledger
        fields = [
            "id",
            "ledger_type",
            "source",
            "amount",
            "balance_before",
            "balance_after",
            "description",
            "reference",
            "created_at",
        ]
        read_only_fields = fields


class VirtualAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = VirtualAccount
        fields = [
            "id",
            "provider",
            "account_number",
            "account_name",
            "bank_name",
            "external_customer_id",
            "is_active",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class WalletConfigSerializer(serializers.ModelSerializer):
    cashback_rate_by_category = serializers.DictField(
        child=serializers.DecimalField(max_digits=5, decimal_places=2),
        required=False,
    )

    def validate_cashback_rate_by_category(self, value):
        return {k: str(v) for k, v in value.items()}

    def validate(self, attrs):
        payvessel = attrs.get("payvessel_enabled", getattr(self.instance, "payvessel_enabled", True))
        if not payvessel:
            raise serializers.ValidationError("PayVessel must remain enabled.")
        attrs["paymentpoint_enabled"] = False
        attrs["default_payment_provider"] = "payvessel"
        return attrs

    class Meta:
        model = WalletConfig
        fields = [
            "funding_charge",
            "cashback_rate_percent",
            "cashback_rate_by_category",
            "paymentpoint_enabled",
            "payvessel_enabled",
            "default_payment_provider",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class PlatformKYCSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        id_type = attrs.get("id_type", getattr(self.instance, "id_type", None))
        id_number = attrs.get("id_number", getattr(self.instance, "id_number", None))
        if id_type not in ("bvn", "nin"):
            raise serializers.ValidationError({"id_type": "Select BVN or NIN."})
        if not id_number or len(id_number) != 11 or not id_number.isdigit():
            raise serializers.ValidationError({"id_number": "Enter a valid 11-digit BVN or NIN."})
        return attrs

    class Meta:
        model = PlatformKYC
        fields = ["id_type", "id_number", "updated_at"]
        read_only_fields = ["updated_at"]


class AdminWalletOperationSerializer(serializers.Serializer):
    """
    Admin-triggered wallet operation (credit/debit).

    ``type`` is required (no default, so a missing value can never become a
    credit). ``action`` / ``description`` are accepted as aliases of
    ``type`` / ``reason`` for the existing frontend.
    """

    type = serializers.ChoiceField(choices=["CREDIT", "DEBIT"])
    amount = serializers.DecimalField(
        max_digits=15, decimal_places=2, min_value=Decimal("0.01")
    )
    reason = serializers.CharField(min_length=3, max_length=200)
    source = serializers.ChoiceField(choices=["WALLET", "CASHBACK"], default="WALLET")
    idempotency_key = serializers.CharField(max_length=64, required=False, allow_blank=False)

    def to_internal_value(self, data):
        data = dict(data.items()) if hasattr(data, "items") else dict(data)
        if "type" not in data and data.get("action"):
            data["type"] = str(data["action"]).upper()
        elif isinstance(data.get("type"), str):
            data["type"] = data["type"].upper()
        if "reason" not in data and data.get("description"):
            data["reason"] = data["description"]
        if isinstance(data.get("source"), str):
            data["source"] = data["source"].upper()
        if isinstance(data.get("reason"), str):
            data["reason"] = data["reason"].strip()
        return super().to_internal_value(data)
