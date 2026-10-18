from decimal import Decimal
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.contrib.auth import get_user_model

User = get_user_model()

class TransactionType(models.TextChoices):
    AIRTIME = "AIRTIME", "Airtime"
    DATA = "DATA", "Data"
    ELECTRICITY = "ELECTRICITY", "Electricity"
    CABLE = "CABLE", "Cable TV"
    BROADBAND = "BROADBAND", "Broadband"
    EDUCATION = "EDUCATION", "Education"
    DEPOSIT = "DEPOSIT", "Deposit"

class TransactionStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    SUCCESS = "SUCCESS", "Success"
    FAILED = "FAILED", "Failed"

class Transaction(models.Model):
    """Transaction model — DBN parity with internal_reference, product FK, cashback, payment_source."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transactions')
    product = models.ForeignKey("products.Product", on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions")
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    type = models.CharField(max_length=20, choices=TransactionType.choices, db_index=True)
    status = models.CharField(max_length=20, choices=TransactionStatus.choices, default=TransactionStatus.PENDING, db_index=True)
    
    # Domain specific identifiers (Target for the vend; for DEPOSIT use "deposit")
    target = models.CharField(max_length=50, default="", blank=True, help_text="Phone, Meter, or Smartcard number")
    phone = models.CharField(max_length=20, blank=True, null=True)
    meter_number = models.CharField(max_length=50, blank=True, null=True)
    smartcard_number = models.CharField(max_length=50, blank=True, null=True)
    token = models.CharField(max_length=255, blank=True, null=True, help_text="Electricity token / PIN")
    quantity = models.PositiveIntegerField(default=1)
    
    provider = models.CharField(max_length=50, blank=True, null=True)
    provider_product_code = models.CharField(max_length=100, blank=True, null=True)
    provider_reference = models.CharField(max_length=255, null=True, blank=True)
    internal_reference = models.CharField(max_length=100, unique=True, db_index=True, null=True, blank=True, help_text="Internal unique ref used as user_reference for provider")
    provider_request = models.JSONField(null=True, blank=True)
    provider_response = models.JSONField(null=True, blank=True)
    error_code = models.CharField(max_length=100, blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)

    # Refund tracking
    is_refunded = models.BooleanField(default=False)
    refunded_at = models.DateTimeField(null=True, blank=True)
    refund_reference = models.CharField(max_length=255, null=True, blank=True)

    # Cashback tracking — DBN parity
    cashback_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal("0.00"))
    cashback_applied = models.BooleanField(default=False)
    cashback_reference = models.CharField(max_length=100, blank=True, null=True)
    cashback_applied_at = models.DateTimeField(null=True, blank=True)
    PAYMENT_SOURCE_WALLET = "WALLET"
    PAYMENT_SOURCE_CASHBACK = "CASHBACK"
    PAYMENT_SOURCE_CHOICES = [(PAYMENT_SOURCE_WALLET, "Main Wallet"), (PAYMENT_SOURCE_CASHBACK, "Cashback Balance")]
    payment_source = models.CharField(max_length=10, choices=PAYMENT_SOURCE_CHOICES, default=PAYMENT_SOURCE_WALLET)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "transactions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["type", "status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["provider_reference"],
                condition=(
                    Q(type=TransactionType.DEPOSIT)
                    & Q(provider_reference__isnull=False)
                    & ~Q(provider_reference="")
                ),
                name="uniq_deposit_provider_reference",
            ),
        ]

    def __str__(self):
        return f"{self.type} - {self.internal_reference or self.id} - {self.status}"

class AdminAuditLog(models.Model):
    """Records every admin action on a transaction or user wallet for accountability."""
    admin = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="audit_logs")
    action = models.CharField(max_length=60)  # e.g. RESOLVE_SUCCESS, RESOLVE_FAILED, BULK_REFUND, WALLET_CREDIT
    transaction = models.ForeignKey(
        "Transaction", on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs"
    )
    target_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="received_audit_logs"
    )
    note = models.TextField(blank=True, default="")
    metadata = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "admin_audit_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} by {self.admin} at {self.created_at}"


class IdempotencyKey(models.Model):
    """Storesempotency keys to prevent double-charging."""
    key = models.CharField(max_length=255, unique=True, db_index=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    path = models.CharField(max_length=255)
    
    # Store the cached HttpResponse details
    response_code = models.IntegerField(null=True, blank=True)
    response_body = models.JSONField(null=True, blank=True)
    has_response = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = "idempotency_keys"
