from decimal import Decimal
from django.contrib.auth.models import AbstractUser
from django.db import models


class UserRole(models.TextChoices):
    ADMIN = "ADMIN", "Admin"
    AGENT = "AGENT", "Agent"
    CUSTOMER = "CUSTOMER", "Customer"


class User(AbstractUser):
    """
    Custom user model extending Django's AbstractUser.

    Notes:
        - ``balance`` is a cached/legacy field kept in sync from the Wallet
          domain via ``WalletService``. Application code should treat the
          associated ``Wallet.balance`` as the source of truth for monetary
          operations.
        - ``is_superuser`` from ``AbstractUser`` continues to distinguish
          admin users from regular customers.
    """

    phone = models.CharField(max_length=20, unique=True, db_index=True, null=True, blank=True)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    transaction_pin = models.CharField(max_length=128, blank=True, default="")
    failed_login_attempts = models.PositiveIntegerField(default=0)
    # Access-level flags — parity with dbn-backend for VTU agent hierarchy
    has_atm_access = models.BooleanField(default=True)
    has_web_access = models.BooleanField(default=True)
    has_app_access = models.BooleanField(default=True)
    has_pos_access = models.BooleanField(default=False)
    has_api_access = models.BooleanField(default=False)
    airtime_limit = models.DecimalField(max_digits=12, decimal_places=2, default=50000.00)
    cloud_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    portal_charges = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    payment_gateway_limit = models.DecimalField(
        max_digits=12, decimal_places=2, default=100000.00
    )
    role = models.CharField(
        max_length=20, choices=UserRole.choices, default=UserRole.CUSTOMER, db_index=True
    )

    class IdType(models.TextChoices):
        BVN = "bvn", "BVN"
        NIN = "nin", "NIN"

    id_type = models.CharField(
        max_length=3,
        choices=IdType.choices,
        blank=True,
        null=True,
        help_text="Identity type used for PalmPay KYC (bvn or nin).",
    )
    id_number = models.CharField(
        max_length=11,
        blank=True,
        null=True,
        help_text="11-digit BVN or NIN for PalmPay KYC.",
    )

    class Meta:
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return f"{self.username} ({self.phone or 'No Phone'})"

    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN or self.is_superuser

    def is_agent(self) -> bool:
        return self.role == UserRole.AGENT

    def is_customer(self) -> bool:
        return self.role == UserRole.CUSTOMER

    # Avoid clashes with auth.Group reverse accessors on custom user
    groups = models.ManyToManyField(
        "auth.Group",
        blank=True,
        related_name="nobledatasub_user_set",
        related_query_name="nobledatasub_user",
    )
    user_permissions = models.ManyToManyField(
        "auth.Permission",
        blank=True,
        related_name="nobledatasub_user_set",
        related_query_name="nobledatasub_user",
    )
