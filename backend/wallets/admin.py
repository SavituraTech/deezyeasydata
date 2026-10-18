from django.contrib import admin
from .models import AdminWalletAdjustment, Wallet, Ledger, WalletConfig


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ["user", "balance", "created_at", "updated_at"]
    search_fields = ["user__username", "user__email", "user__phone"]
    raw_id_fields = ["user"]
    # Balances only change through WalletService (ledger + User.balance sync);
    # editing them here would bypass the audit trail.
    readonly_fields = ["balance", "cashback_balance", "created_at", "updated_at"]


@admin.register(Ledger)
class LedgerAdmin(admin.ModelAdmin):
    list_display = [
        "reference",
        "wallet",
        "ledger_type",
        "amount",
        "balance_after",
        "created_at",
    ]
    list_filter = ["ledger_type", "created_at"]
    search_fields = ["reference", "wallet__user__username", "description"]
    readonly_fields = [
        "wallet",
        "ledger_type",
        "amount",
        "balance_before",
        "balance_after",
        "description",
        "reference",
        "created_at",
    ]


@admin.register(WalletConfig)
class WalletConfigAdmin(admin.ModelAdmin):
    list_display = ["funding_charge", "updated_at"]


@admin.register(AdminWalletAdjustment)
class AdminWalletAdjustmentAdmin(admin.ModelAdmin):
    list_display = ["id", "admin", "user", "adjustment_type", "source", "amount", "status", "created_at"]
    list_filter = ["status", "adjustment_type", "source"]
    search_fields = ["admin__username", "user__username", "reason", "idempotency_key"]
    readonly_fields = [f.name for f in AdminWalletAdjustment._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
