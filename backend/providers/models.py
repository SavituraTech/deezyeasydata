import os
from django.db import models


class Provider(models.Model):
    """
    Database-driven provider configuration.

    Stores API credentials (via env-var name), base URLs, timeout, and
    which service categories the provider can fulfill.  Having this in the
    database means an admin can toggle a provider off, swap its URL, or
    adjust its timeout without re-deploying the application.
    """

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"
        MAINTENANCE = "MAINTENANCE", "Under Maintenance"

    # ------------------------------------------------------------------ identity
    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Human-readable name, e.g. 'Newdatasub'",
    )
    slug = models.SlugField(
        max_length=50,
        unique=True,
        help_text="Machine-friendly key used in code, e.g. 'newdatasub'",
    )

    # ------------------------------------------------------------------ connection
    base_url = models.URLField(
        max_length=500,
        help_text="Provider's vending API base URL",
    )
    api_key_env_var = models.CharField(
        max_length=100,
        default="NEWDATASUB_API_KEY",
        help_text=(
            "Name of the environment variable that holds this provider's API key. "
            "The key itself is never stored in the database."
        ),
    )
    timeout_seconds = models.PositiveIntegerField(
        default=60,
        help_text="HTTP request timeout in seconds",
    )

    # ------------------------------------------------------------------ status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )

    # ------------------------------------------------------------------ capabilities
    supported_services = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            "List of service category keys this provider supports, e.g. "
            '["AIRTIME", "DATA", "ELECTRICITY"]'
        ),
    )

    # ------------------------------------------------------------------ extra config
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Free-form key/value store for any additional provider-specific config",
    )

    # ------------------------------------------------------------------ audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "providers"
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} [{self.status}]"

    # ------------------------------------------------------------------ helpers
    @property
    def api_key(self) -> str:
        """Resolve the actual API key from the environment at call time."""
        return os.getenv(self.api_key_env_var, "")

    @property
    def is_active(self) -> bool:
        return self.status == self.Status.ACTIVE
