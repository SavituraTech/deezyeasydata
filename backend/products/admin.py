from django.contrib import admin
from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "category",
        "network",
        "provider",
        "provider_product_code",
        "cost_price",
        "selling_price",
        "commission",
        "is_active",
    ]
    list_filter = ["category", "provider", "network", "is_active"]
    search_fields = ["name", "provider_product_code", "description"]
    list_editable = ["is_active", "selling_price"]
    readonly_fields = ["created_at", "updated_at"]
    fieldsets = [
        ("Identity", {"fields": ["name", "category", "network", "description", "image_url"]}),
        ("Provider", {"fields": ["provider", "provider_product_code"]}),
        ("Pricing", {"fields": ["cost_price", "selling_price", "commission"]}),
        ("Data Plan", {"fields": ["data_size", "data_validity", "plan_group"], "classes": ["collapse"]}),
        ("Status", {"fields": ["is_active"]}),
        ("Audit", {"fields": ["created_at", "updated_at"], "classes": ["collapse"]}),
    ]
