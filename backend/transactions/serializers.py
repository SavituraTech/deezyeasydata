from rest_framework import serializers
from products.models import Network
from common.helpers import is_valid_nigerian_phone
from .models import Transaction


class TransactionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True, default=None)
    product_id = serializers.IntegerField(source="product.id", read_only=True, default=None)
    description = serializers.SerializerMethodField()
    cashback_amount = serializers.DecimalField(max_digits=15, decimal_places=2, default=0)

    class Meta:
        model = Transaction
        fields = [
            'id', 'amount', 'type', 'status', 'target', 'phone',
            'product_name', 'product_id', 'description',
            'provider_reference', 'is_refunded', 'cashback_amount',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']

    def get_description(self, obj) -> str:
        return obj.target or ""


class TransactionDetailSerializer(serializers.ModelSerializer):
    user = serializers.IntegerField(source="user_id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True, default=None)
    product_id = serializers.IntegerField(source="product.id", read_only=True, default=None)
    description = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            "id",
            "amount",
            "type",
            "status",
            "target",
            "phone",
            "product_name",
            "product_id",
            "description",
            "provider_reference",
            "provider_request",
            "provider_response",
            "is_refunded",
            "refunded_at",
            "refund_reference",
            "cashback_amount",
            "cashback_applied",
            "user",
            "username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_description(self, obj) -> str:
        return obj.target or ""

class VendRequestSerializer(serializers.Serializer):
    """Serializer for initiating a vend transaction."""
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    type = serializers.ChoiceField(choices=['AIRTIME', 'DATA', 'ELECTRICITY', 'CABLE', 'BROADBAND', 'EDUCATION'])
    target = serializers.CharField(max_length=50)
    provider_payload = serializers.JSONField(help_text="The raw payload required by the specific provider action.")


class BuyAirtimeRequestSerializer(serializers.Serializer):
    """Product-based airtime purchase. Provide product_id, or network + amount."""
    product_id = serializers.IntegerField(required=False, allow_null=True)
    network = serializers.ChoiceField(
        choices=Network.choices,
        required=False,
        allow_null=True,
    )
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=1)
    phone = serializers.CharField(max_length=20)
    use_cashback = serializers.BooleanField(required=False, default=False)

    def validate_phone(self, value):
        if not is_valid_nigerian_phone(value):
            raise serializers.ValidationError(
                "Invalid Nigerian phone number. Must be 11 digits starting with 070/080/081/090/091."
            )
        return value

    def validate(self, attrs):
        if not attrs.get("product_id") and not attrs.get("network"):
            raise serializers.ValidationError(
                "Provide either product_id or network."
            )
        return attrs


class BuyDataRequestSerializer(serializers.Serializer):
    """Product-based data purchase."""
    product_id = serializers.IntegerField()
    phone = serializers.CharField(max_length=20)

    def validate_phone(self, value):
        if not is_valid_nigerian_phone(value):
            raise serializers.ValidationError(
                "Invalid Nigerian phone number. Must be 11 digits starting with 070/080/081/090/091."
            )
        return value


class VerifyMeterSerializer(serializers.Serializer):
    """Verify an electricity meter before purchase."""
    meter_number = serializers.CharField(max_length=30)
    meter_type = serializers.ChoiceField(choices=[("prepaid", "Prepaid"), ("postpaid", "Postpaid")])
    disco_code = serializers.CharField(max_length=30, help_text="Electricity distribution company code")


class VerifySmartcardSerializer(serializers.Serializer):
    """Verify a cable TV smartcard before purchase."""
    smartcard_number = serializers.CharField(max_length=30)
    cable_provider = serializers.CharField(max_length=30, help_text="e.g. DSTV, GOTV, STARTIMES")


class VerifyBroadbandSerializer(serializers.Serializer):
    """Verify a broadband account before purchase."""
    account_number = serializers.CharField(max_length=30)
    broadband_provider = serializers.CharField(max_length=30)


class BuyElectricitySerializer(serializers.Serializer):
    """Electricity token purchase."""
    product_id = serializers.IntegerField()
    meter_number = serializers.CharField(max_length=30)
    meter_type = serializers.ChoiceField(choices=[("prepaid", "Prepaid"), ("postpaid", "Postpaid")])
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=1)
    customer_name = serializers.CharField(max_length=100, required=False, allow_blank=True)


class BuyCableSerializer(serializers.Serializer):
    """Cable TV subscription purchase."""
    product_id = serializers.IntegerField()
    smartcard_number = serializers.CharField(max_length=30)
    customer_name = serializers.CharField(max_length=100, required=False, allow_blank=True)


class BuyBroadbandSerializer(serializers.Serializer):
    """Broadband subscription purchase."""
    product_id = serializers.IntegerField()
    account_number = serializers.CharField(max_length=30)
    customer_name = serializers.CharField(max_length=100, required=False, allow_blank=True)


class BuyEducationSerializer(serializers.Serializer):
    """Education PIN purchase (WAEC, NECO, etc.)."""
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, max_value=10, default=1)
