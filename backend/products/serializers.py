from rest_framework import serializers
from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "category",
            "network",
            "provider",
            "provider_product_code",
            "cost_price",
            "selling_price",
            "commission",
            "description",
            "image_url",
            "is_active",
            "cashback_enabled",
            "cashback_rate_percent",
            "data_size",
            "data_validity",
            "plan_group",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ProductListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "category",
            "network",
            "provider",
            "provider_product_code",
            "cost_price",
            "selling_price",
            "commission",
            "description",
            "image_url",
            "is_active",
            "cashback_enabled",
            "cashback_rate_percent",
            "data_size",
            "data_validity",
            "plan_group",
        ]
