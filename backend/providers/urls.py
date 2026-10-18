from django.urls import path
from .views import (
    ProviderDetailView,
    ProviderHealthView,
    ProviderListView,
    ProviderToggleStatusView,
    ProviderHealthSummaryView,
    ProviderAutoFailoverView,
)

urlpatterns = [
    path("", ProviderListView.as_view(), name="provider_list"),
    path("<int:pk>/", ProviderDetailView.as_view(), name="provider_detail"),
    path("<int:pk>/status/", ProviderToggleStatusView.as_view(), name="provider_toggle_status"),
    path("<int:pk>/health/", ProviderHealthView.as_view(), name="provider_health"),
    path("admin/health-summary/", ProviderHealthSummaryView.as_view(), name="provider_health_summary"),
    path("admin/auto-failover/", ProviderAutoFailoverView.as_view(), name="provider_auto_failover"),
]
