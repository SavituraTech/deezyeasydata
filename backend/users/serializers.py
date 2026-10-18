from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from drf_spectacular.utils import extend_schema_field
from common.helpers import is_valid_nigerian_phone
from common.exceptions import InvalidPhoneNumberException
from users.models import UserRole

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model - used for reading user data. Parity with DBN."""

    name = serializers.SerializerMethodField(read_only=True)
    status = serializers.SerializerMethodField(read_only=True)
    wallet_balance = serializers.SerializerMethodField(read_only=True)
    cashback_balance = serializers.SerializerMethodField(read_only=True)
    is_superuser = serializers.BooleanField(read_only=True)
    created_at = serializers.DateTimeField(source="date_joined", read_only=True)
    updated_at = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "name",
            "email",
            "first_name",
            "last_name",
            "phone",
            "role",
            "is_staff",
            "is_superuser",
            "status",
            "is_active",
            "balance",
            "wallet_balance",
            "cashback_balance",
            "has_atm_access",
            "has_web_access",
            "has_app_access",
            "has_pos_access",
            "has_api_access",
            "airtime_limit",
            "cloud_charges",
            "portal_charges",
            "payment_gateway_limit",
            "failed_login_attempts",
            "date_joined",
            "created_at",
            "updated_at",
            "id_type",
            "id_number",
        ]
        read_only_fields = [
            "id",
            "balance",
            "failed_login_attempts",
            "is_superuser",
            "date_joined",
        ]

    def get_name(self, obj) -> str:
        parts = [obj.first_name or "", obj.last_name or ""]
        combined = " ".join(p.strip() for p in parts if p.strip()).strip()
        return combined or obj.username

    def get_status(self, obj) -> str:
        return "active" if obj.is_active else "inactive"

    @extend_schema_field(serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True))
    def get_wallet_balance(self, obj):
        try:
            return obj.wallet.balance
        except Exception:
            from wallets.services import WalletService
            return WalletService.get_balance(obj)

    @extend_schema_field(serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True))
    def get_cashback_balance(self, obj):
        try:
            return obj.wallet.cashback_balance
        except Exception:
            return None

    @extend_schema_field(serializers.DateTimeField(allow_null=True))
    def get_updated_at(self, obj):
        return getattr(obj, "date_joined", None)


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new users."""

    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    name = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=150)

    class Meta:
        model = User
        fields = [
            "username",
            "name",
            "email",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
            "phone",
        ]

    def validate_phone(self, value):
        if value and not is_valid_nigerian_phone(value):
            raise InvalidPhoneNumberException()
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError(
                {"password": "Password fields didn't match."}
            )
        return attrs

    def create(self, validated_data):
        name = (validated_data.pop("name", None) or "").strip()
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
            first_name=validated_data.get("first_name", "") or name,
            last_name=validated_data.get("last_name", ""),
            phone=validated_data.get("phone"),
        )
        return user


class UserRegistrationSerializer(UserCreateSerializer):
    """Alias for compatibility with dbn contract (password2)."""
    password2 = serializers.CharField(write_only=True, required=False)

    def validate(self, attrs):
        # support both password_confirm and password2
        p2 = attrs.pop("password2", None) or attrs.get("password_confirm")
        if "password2" in self.initial_data and p2 != attrs.get("password"):
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return super().validate(attrs)


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing password."""

    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value


class UpdateProfileSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile."""

    class Meta:
        model = User
        fields = ["first_name", "last_name", "phone", "id_type", "id_number"]

    def validate_phone(self, value):
        if value and not is_valid_nigerian_phone(value):
            raise serializers.ValidationError("Invalid phone number format.")
        return value

    def validate(self, attrs):
        id_type = attrs.get("id_type") or (self.instance.id_type if self.instance else None)
        id_number = attrs.get("id_number") or (self.instance.id_number if self.instance else None)
        if attrs.get("id_number") and not attrs.get("id_type") and not id_type:
            raise serializers.ValidationError(
                {"id_type": "id_type is required when providing id_number."}
            )
        if attrs.get("id_number") and len(attrs["id_number"]) != 11:
            raise serializers.ValidationError(
                {"id_number": "id_number must be exactly 11 digits."}
            )
        if attrs.get("id_number") and not attrs["id_number"].isdigit():
            raise serializers.ValidationError(
                {"id_number": "id_number must contain digits only."}
            )
        return attrs


class ProfileUpdateSerializer(serializers.Serializer):
    """DBN-compatible name/email/phone patch serializer."""
    name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=20)
    id_type = serializers.ChoiceField(choices=["bvn", "nin"], required=False, allow_null=True)
    id_number = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=11)

    def validate(self, attrs):
        id_type = attrs.get("id_type", getattr(self.instance, "id_type", None))
        id_number = attrs.get("id_number", getattr(self.instance, "id_number", None))
        if bool(id_type) != bool(id_number):
            raise serializers.ValidationError(
                {"id_number": "Select BVN or NIN and enter the corresponding number."}
            )
        if id_number and (len(id_number) != 11 or not id_number.isdigit()):
            raise serializers.ValidationError(
                {"id_number": "BVN or NIN must be exactly 11 digits."}
            )
        return attrs

    def validate_phone(self, value):
        if value and not is_valid_nigerian_phone(value):
            raise serializers.ValidationError("Invalid phone number format.")
        if value and User.objects.filter(phone=value).exclude(pk=self.context["request"].user.pk).exists():
            raise serializers.ValidationError("This phone number is already in use.")
        return value.strip() if value else value

    def update(self, instance, validated_data):
        if "name" in validated_data:
            instance.first_name = (validated_data["name"] or "").strip() or instance.first_name
        if "email" in validated_data:
            instance.email = (validated_data["email"] or "").strip() or None
        if "phone" in validated_data and validated_data["phone"]:
            instance.phone = validated_data["phone"]
        if "id_type" in validated_data:
            instance.id_type = validated_data["id_type"] or None
        if "id_number" in validated_data:
            instance.id_number = validated_data["id_number"] or None
        instance.save()
        return instance


class UserLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class AdminUserCreateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=150)
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ["username", "name", "phone", "email", "password", "role"]

    def validate_phone(self, value):
        if value and not is_valid_nigerian_phone(value):
            raise InvalidPhoneNumberException()
        return value

    def create(self, validated_data):
        name = (validated_data.pop("name", None) or "").strip()
        user = User.objects.create_user(**validated_data)
        if name:
            user.first_name = name
            user.save(update_fields=["first_name"])
        return user


class AdminUserUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=20)
    role = serializers.ChoiceField(choices=UserRole.choices, required=False)
    is_active = serializers.BooleanField(required=False)

    def update(self, instance, validated_data):
        if "name" in validated_data:
            instance.first_name = (validated_data["name"] or "").strip() or instance.first_name
        if "email" in validated_data:
            instance.email = (validated_data["email"] or "").strip() or None
        if "phone" in validated_data and validated_data["phone"]:
            instance.phone = validated_data["phone"]
        if "role" in validated_data:
            instance.role = validated_data["role"]
        if "is_active" in validated_data:
            instance.is_active = validated_data["is_active"]
        instance.save()
        return instance


class AdminUserLimitsUpdateSerializer(serializers.Serializer):
    has_atm_access = serializers.BooleanField(required=False)
    has_web_access = serializers.BooleanField(required=False)
    has_app_access = serializers.BooleanField(required=False)
    has_pos_access = serializers.BooleanField(required=False)
    has_api_access = serializers.BooleanField(required=False)
    airtime_limit = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    cloud_charges = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    portal_charges = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    payment_gateway_limit = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class AdminWalletTransactionSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=1)
    action = serializers.ChoiceField(choices=["credit", "debit"])
    description = serializers.CharField(max_length=255)


class AdminUserPasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, required=True, validators=[validate_password])

    def update(self, instance, validated_data):
        instance.set_password(validated_data["new_password"])
        instance.save()
        return instance


class AdminUserPinResetSerializer(serializers.Serializer):
    new_pin = serializers.CharField(write_only=True, required=True, min_length=4, max_length=4)

    def update(self, instance, validated_data):
        from django.contrib.auth.hashers import make_password
        instance.transaction_pin = make_password(validated_data["new_pin"])
        instance.save()
        return instance
