from django.contrib import admin
from .models import Provider


@admin.register(Provider)
class ProviderAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "base_url", "status", "timeout_seconds", "updated_at")
    list_filter = ("status",)
    search_fields = ("name", "slug")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("name",)

    fieldsets = (
        (
            "Identity",
            {"fields": ("name", "slug")},
        ),
        (
            "Connection",
            {
                "fields": ("base_url", "api_key_env_var", "timeout_seconds"),
                "description": (
                    "The API key is read from the named environment variable at runtime "
                    "and is never stored in the database."
                ),
            },
        ),
        (
            "Status & Capabilities",
            {"fields": ("status", "supported_services")},
        ),
        (
            "Extra Config",
            {"fields": ("metadata",), "classes": ("collapse",)},
        ),
        (
            "Audit",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    actions = ["mark_active", "mark_inactive", "mark_maintenance"]

    @admin.action(description="Set selected providers to Active")
    def mark_active(self, request, queryset):
        queryset.update(status=Provider.Status.ACTIVE)

    @admin.action(description="Set selected providers to Inactive")
    def mark_inactive(self, request, queryset):
        queryset.update(status=Provider.Status.INACTIVE)

    @admin.action(description="Set selected providers to Maintenance")
    def mark_maintenance(self, request, queryset):
        queryset.update(status=Provider.Status.MAINTENANCE)
