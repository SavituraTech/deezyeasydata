from django.urls import path
from .views import (
    ProductListView,
    ProductCategoryView,
    ProductDetailView,
    AdminProductListView,
    AdminProductDetailView,
)

urlpatterns = [
    # Public endpoints
    path("", ProductListView.as_view(), name="product_list"),
    path("category/", ProductCategoryView.as_view(), name="product_category"),
    path("<int:pk>/", ProductDetailView.as_view(), name="product_detail"),
    # Admin endpoints
    path("admin/", AdminProductListView.as_view(), name="admin_product_list"),
    path(
        "admin/<int:pk>/", AdminProductDetailView.as_view(), name="admin_product_detail"
    ),
]
