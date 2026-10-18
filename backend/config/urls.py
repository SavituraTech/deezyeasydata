"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

import requests as http_client

from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


def health_check(request):
    """Health check endpoint for load balancers and monitoring."""
    return JsonResponse(
        {"success": True, "status": "healthy", "service": "deezy-easy-data-api"}
    )


def ip_check(request):
    """
    Return both IPs needed for provider whitelisting:
    - inbound_ip: IP Railway presents on incoming requests (X-Forwarded-For)
    - outbound_ip: IP providers like Newdatasub see when we call their API
    """
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    inbound_ip = xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR")

    try:
        outbound_ip = http_client.get("https://api.ipify.org", timeout=5).text.strip()
    except Exception:
        outbound_ip = None

    return JsonResponse({
        "inbound_ip": inbound_ip,
        "outbound_ip": outbound_ip,
        "whitelist_both": [ip for ip in [inbound_ip, outbound_ip] if ip],
    })


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health_check, name="health_check"),
    path("ip/", ip_check, name="ip_check"),
    # OpenAPI Schema & Docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    # JWT Auth
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # App specific URLs — no version prefix (per product decision)
    path("api/users/", include("users.urls")),
    path("api/transactions/", include("transactions.urls")),
    path("api/products/", include("products.urls")),
    path("api/wallets/", include("wallets.urls")),
    path("api/integrations/", include("integrations.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/providers/", include("providers.urls")),
]
