from decimal import Decimal
from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator
from products.models import ProductCategory

User = get_user_model()


class Wallet(models.Model):
    """
    User wallet for storing balance.
    """

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="wallet")
    balance = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    cashback_balance = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Accumulated cashback. Spendable on airtime purchases only.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wallets"

    def __str__(self):
        return f"Wallet({self.user.username}) - ₦{self.balance}"


class Ledger(models.Model):
    """
    Transaction ledger for wallet operations - provides complete audit trail.
    """

    class LedgerType(models.TextChoices):
        CREDIT = "CREDIT", "Credit"
        DEBIT = "DEBIT", "Debit"

    class BalanceSource(models.TextChoices):
        WALLET = "WALLET", "Wallet"
        CASHBACK = "CASHBACK", "Cashback"

    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name="ledgers")
    ledger_type = models.CharField(max_length=10, choices=LedgerType.choices)
    source = models.CharField(
        max_length=10, choices=BalanceSource.choices, default=BalanceSource.WALLET
    )
    amount = models.DecimalField(
        max_digits=15, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))]
    )
    balance_before = models.DecimalField(max_digits=15, decimal_places=2)
    balance_after = models.DecimalField(max_digits=15, decimal_places=2)

    description = models.CharField(max_length=255)
    reference = models.CharField(max_length=100, unique=True, db_index=True)

    related_transaction = models.ForeignKey(
        "transactions.Transaction",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ledgers",
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "ledger"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["wallet", "-created_at"]),
            models.Index(fields=["reference"]),
        ]

    def __str__(self):
        return f"{self.ledger_type} - ₦{self.amount} - {self.reference}"


class AdminWalletAdjustment(models.Model):
    """
    Audit record for every manual admin credit/debit (who, why, how much, outcome).

    Large adjustments are created PENDING_APPROVAL and only move money once a
    different admin approves them.
    """

    class Type(models.TextChoices):
        CREDIT = "CREDIT", "Credit"
        DEBIT = "DEBIT", "Debit"

    class Source(models.TextChoices):
        WALLET = "WALLET", "Wallet"
        CASHBACK = "CASHBACK", "Cashback"

    class Status(models.TextChoices):
        PENDING_APPROVAL = "PENDING_APPROVAL", "Pending approval"
        APPLIED = "APPLIED", "Applied"
        REJECTED = "REJECTED", "Rejected"

    admin = models.ForeignKey(User, on_delete=models.PROTECT, related_name="wallet_adjustments_made")
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name="wallet_adjustments")
    adjustment_type = models.CharField(max_length=10, choices=Type.choices)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.WALLET)
    amount = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    reason = models.CharField(max_length=200)
    idempotency_key = models.CharField(max_length=64)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING_APPROVAL, db_index=True)
    approved_by = models.ForeignKey(
        User, on_delete=models.PROTECT, null=True, blank=True, related_name="wallet_adjustments_decided"
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    ledger = models.ForeignKey(Ledger, on_delete=models.SET_NULL, null=True, blank=True, related_name="admin_adjustments")
    balance_before = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    balance_after = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "admin_wallet_adjustments"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["admin", "idempotency_key"], name="uniq_admin_adjustment_key"),
        ]

    def __str__(self):
        return f"{self.adjustment_type} ₦{self.amount} {self.source} user={self.user_id} by={self.admin_id} [{self.status}]"


class VirtualAccount(models.Model):
    """Simple virtual account record attached to a user."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="virtual_accounts")
    provider = models.CharField(max_length=50, default="PAYVESSEL")
    account_number = models.CharField(max_length=20, unique=True, db_index=True)
    account_name = models.CharField(max_length=120)
    bank_name = models.CharField(max_length=120, default="Deezy Easy Data Partner Bank")
    external_customer_id = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    is_active = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "virtual_accounts"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} - {self.account_number}"


class PlatformKYC(models.Model):
    """Singleton model holding the shared KYC identity used for virtual account creation."""
    id_type = models.CharField(max_length=3, blank=True, null=True, help_text="bvn or nin")
    id_number = models.CharField(max_length=11, blank=True, null=True, help_text="11-digit BVN or NIN")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "platform_kyc"
        verbose_name = "Platform KYC Configuration"

    @classmethod
    def get_solo(cls) -> "PlatformKYC":
        config, _ = cls.objects.get_or_create(pk=1)
        return config

    def __str__(self):
        return f"PlatformKYC(id_type={self.id_type})"


class WalletConfig(models.Model):
    """
    Global wallet configuration values managed by admins.
    """

    funding_charge = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("25.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    cashback_rate_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    cashback_rate_by_category = models.JSONField(
        default=dict,
        blank=True,
        help_text="Map of product category to cashback rate percent.",
    )
    paymentpoint_enabled = models.BooleanField(default=False)
    payvessel_enabled = models.BooleanField(default=True)
    default_payment_provider = models.CharField(
        max_length=20,
        choices=[("paymentpoint", "PaymentPoint"), ("payvessel", "PayVessel")],
        default="payvessel",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wallet_config"

    def __str__(self):
        return f"WalletConfig(funding_charge={self.funding_charge})"

    @classmethod
    def get_solo(cls) -> "WalletConfig":
        defaults = {
            "cashback_rate_by_category": {
                ProductCategory.AIRTIME: "0.00",
                ProductCategory.DATA: "0.00",
                ProductCategory.ELECTRICITY: "0.00",
                ProductCategory.CABLE: "0.00",
                ProductCategory.BROADBAND: "0.00",
                ProductCategory.EDUCATION: "0.00",
            }
        }
        obj, _ = cls.objects.get_or_create(pk=1, defaults=defaults)
        return obj


class PlatformSettings(models.Model):
    """DBN-compatible singleton for platform-wide cashback + stamp duty (alias to WalletConfig)."""

    default_purchase_cashback_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("1.00"))
    deposit_cashback_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("1.00"))
    stamp_duty_enabled = models.BooleanField(default=False)
    stamp_duty_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("30.00"))
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "platform_settings"
        verbose_name = "Platform Settings"

    @classmethod
    def get_config(cls) -> "PlatformSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
