import decimal
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver


class ProductCategory(models.TextChoices):
    AIRTIME = "AIRTIME", "Airtime"
    DATA = "DATA", "Data"
    SME_DATA = "SME_DATA", "SME Data Share"
    ELECTRICITY = "ELECTRICITY", "Electricity"
    CABLE = "CABLE", "Cable TV"
    BROADBAND = "BROADBAND", "Broadband"
    EDUCATION = "EDUCATION", "Education"
    STREAMING = "STREAMING", "Streaming Services"


class Network(models.TextChoices):
    """Mobile network for telco products (airtime/data)."""
    MTN = "MTN", "MTN"
    GLO = "GLO", "GLO"
    AIRTEL = "AIRTEL", "Airtel"
    N9MOBILE = "9MOBILE", "9mobile"


class Product(models.Model):
    """
    Product model for vending catalog. Parity with DBN: persisted margin, face_value, validators.
    """

    name = models.CharField(max_length=200)
    category = models.CharField(
        max_length=20, choices=ProductCategory.choices, db_index=True
    )
    network = models.CharField(
        max_length=20,
        choices=Network.choices,
        blank=True,
        null=True,
        db_index=True,
        help_text="Mobile network for airtime/data. Null for other categories.",
    )
    provider = models.CharField(max_length=100, blank=True, null=True, db_index=True, help_text="Provider name (e.g., NEWDATASUB, SMEPLUG)")
    provider_product_code = models.CharField(max_length=100, blank=True, null=True)
    external_product_code = models.CharField(max_length=100, blank=True, null=True, help_text="Alias for provider_product_code (DBN parity)")

    # Pricing — with validators
    face_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), validators=[MinValueValidator(Decimal("0.00"))])
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))])
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))])
    commission = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    margin = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    # Display
    description = models.TextField(blank=True, null=True)
    image_url = models.URLField(blank=True, null=True)
    is_active = models.BooleanField(default=True, db_index=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    cashback_enabled = models.BooleanField(default=True)
    cashback_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"), validators=[MinValueValidator(Decimal("0.00"))])
    cashback_rate_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Optional per-product cashback rate override (legacy).",
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    # For data products
    data_size = models.CharField(max_length=50, blank=True, null=True)
    data_validity = models.CharField(max_length=50, blank=True, null=True)
    # Data plan sub-category from the provider payload (CORPORATE, SME, GIFTING, AWOOF).
    # Lets the UI group MTN/GLO/AIRTEL/9MOBILE plans into tabs (dbn-frontend parity).
    plan_group = models.CharField(max_length=20, blank=True, null=True, db_index=True)

    class Meta:
        db_table = "products"
        # Catalog arrangement: group by category, then network, then cheap-to-expensive.
        ordering = ["category", "network", "selling_price", "name"]
        indexes = [
            models.Index(fields=["category", "is_active"]),
            models.Index(fields=["provider", "is_active"]),
            models.Index(fields=["network", "category", "is_active"]),
        ]

    def __str__(self):
        return f"{self.name} - ₦{self.selling_price}"

    def save(self, *args, **kwargs):
        self.margin = (self.selling_price or Decimal("0")) - (self.cost_price or Decimal("0")) - (self.commission or Decimal("0"))
        # keep alias in sync
        if self.provider_product_code and not self.external_product_code:
            self.external_product_code = self.provider_product_code
        if self.external_product_code and not self.provider_product_code:
            self.provider_product_code = self.external_product_code
        # keep legacy cashback_rate_percent and new cashback_percent in sync
        if self.cashback_rate_percent is not None and self.cashback_percent == Decimal("0.00"):
            self.cashback_percent = self.cashback_rate_percent
        super().save(*args, **kwargs)

    def soft_delete(self):
        from django.utils import timezone
        self.is_active = False
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=["is_active", "is_deleted", "deleted_at"])


@receiver([post_save, post_delete], sender=Product)
def _invalidate_product_catalog(sender, instance, **kwargs):
    """Drop the cached active catalog whenever a product changes."""
    from products.cache import invalidate_active_products_cache
    invalidate_active_products_cache()
