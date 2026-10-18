from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from common.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
import time

from .models import Provider
from products.models import Product
from transactions.models import Transaction, TransactionStatus


# ------------------------------------------------------------------ serializers

class ProviderSerializer(serializers.ModelSerializer):
    """Full serializer used by list and detail endpoints."""

    api_key_resolved = serializers.SerializerMethodField(
        help_text="Whether the env-var for this provider's API key is currently set"
    )

    class Meta:
        model = Provider
        fields = [
            "id",
            "name",
            "slug",
            "base_url",
            "api_key_env_var",
            "api_key_resolved",
            "timeout_seconds",
            "status",
            "supported_services",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "api_key_resolved"]

    def get_api_key_resolved(self, obj: Provider) -> bool:
        """Return True if the API key env-var is set (non-empty) in the environment."""
        return bool(obj.api_key)


class ProviderStatusSerializer(serializers.Serializer):
    """Minimal serializer for the toggle-status action."""

    status = serializers.ChoiceField(choices=Provider.Status.choices)


# ------------------------------------------------------------------ views

class ProviderListView(APIView):
    """
    Admin-only list of all configured providers.
    GET  /api/providers/          → list all providers
    POST /api/providers/          → create a new provider record
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(responses=ProviderSerializer(many=True))
    def get(self, request):
        providers = Provider.objects.all()
        return Response(ProviderSerializer(providers, many=True).data)

    @extend_schema(request=ProviderSerializer, responses={201: ProviderSerializer})
    def post(self, request):
        serializer = ProviderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        provider = serializer.save()
        return Response(ProviderSerializer(provider).data, status=status.HTTP_201_CREATED)


class ProviderDetailView(APIView):
    """
    Admin-only detail/update/delete for a single provider.
    GET    /api/providers/<id>/   → retrieve
    PATCH  /api/providers/<id>/   → partial update
    DELETE /api/providers/<id>/   → hard delete
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    def _get_provider(self, pk):
        return Provider.objects.filter(pk=pk).first()

    @extend_schema(responses={200: ProviderSerializer, 404: OpenApiTypes.OBJECT})
    def get(self, request, pk):
        provider = self._get_provider(pk)
        if not provider:
            return Response({"error": "Provider not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProviderSerializer(provider).data)

    @extend_schema(request=ProviderSerializer, responses={200: ProviderSerializer, 404: OpenApiTypes.OBJECT})
    def patch(self, request, pk):
        provider = self._get_provider(pk)
        if not provider:
            return Response({"error": "Provider not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ProviderSerializer(provider, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ProviderSerializer(provider).data)

    @extend_schema(responses={204: None, 404: OpenApiTypes.OBJECT})
    def delete(self, request, pk):
        provider = self._get_provider(pk)
        if not provider:
            return Response({"error": "Provider not found."}, status=status.HTTP_404_NOT_FOUND)
        provider.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProviderToggleStatusView(APIView):
    """
    Set a provider's status.
    POST /api/providers/<id>/status/  body: { "status": "ACTIVE"|"INACTIVE"|"MAINTENANCE" }
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(
        request=ProviderStatusSerializer,
        responses={200: ProviderSerializer, 404: OpenApiTypes.OBJECT},
    )
    def post(self, request, pk):
        provider = Provider.objects.filter(pk=pk).first()
        if not provider:
            return Response({"error": "Provider not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ProviderStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        provider.status = serializer.validated_data["status"]
        provider.save(update_fields=["status", "updated_at"])
        return Response(ProviderSerializer(provider).data)


class ProviderHealthView(APIView):
    """
    Ping the provider's API to check connectivity.
    GET /api/providers/<id>/health/
    Calls balance action — a lightweight read-only probe.
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request, pk):
        provider = Provider.objects.filter(pk=pk).first()
        if not provider:
            return Response({"error": "Provider not found."}, status=status.HTTP_404_NOT_FOUND)

        if not provider.is_active:
            return Response(
                {"success": False, "message": f"Provider is {provider.status}. Set to ACTIVE first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .client import NewdatasubClient

        try:
            client = NewdatasubClient(
                api_key=provider.api_key,
                base_url=provider.base_url,
                timeout=provider.timeout_seconds,
            )
            raw = client.make_request({"action": "balance"})
            if not bool(raw.get("status")):
                raw = client.make_request({"action": "wallet_balance"})
            return Response({"success": True, "provider": provider.slug, "response": raw})
        except Exception as exc:
            return Response(
                {"success": False, "provider": provider.slug, "message": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class ProviderHealthSummaryView(APIView):
    """Admin provider health snapshot with latency and recent success rates."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        window_hours = int(request.query_params.get("window_hours", 24))
        period_start = timezone.now() - timezone.timedelta(hours=max(1, min(window_hours, 168)))
        providers = Provider.objects.all().order_by("name")
        payload = []

        for provider in providers:
            product_count = Product.objects.filter(provider=provider.slug, is_active=True).count()
            tx_qs = Transaction.objects.filter(
                created_at__gte=period_start,
                provider_request__provider=provider.slug,
            )
            total = tx_qs.count()
            success = tx_qs.filter(status=TransactionStatus.SUCCESS).count()
            failed = tx_qs.filter(status=TransactionStatus.FAILED).count()
            pending = tx_qs.filter(status=TransactionStatus.PENDING).count()
            success_rate = round((success / total * 100), 2) if total else None

            probe_ok = False
            probe_message = ""
            latency_ms = None
            if provider.is_active:
                from .client import NewdatasubClient

                started = time.perf_counter()
                try:
                    client = NewdatasubClient(
                        api_key=provider.api_key,
                        base_url=provider.base_url,
                        timeout=provider.timeout_seconds,
                    )
                    raw = client.make_request({"action": "balance"})
                    if not bool(raw.get("status")):
                        raw = client.make_request({"action": "wallet_balance"})
                    probe_ok = bool(raw.get("status"))
                    probe_message = str(raw.get("message") or raw.get("server_message") or "")
                except Exception as exc:
                    probe_ok = False
                    probe_message = str(exc)
                finally:
                    latency_ms = int((time.perf_counter() - started) * 1000)
            else:
                probe_message = f"Provider is {provider.status}."

            payload.append(
                {
                    "id": provider.id,
                    "name": provider.name,
                    "slug": provider.slug,
                    "status": provider.status,
                    "timeout_seconds": provider.timeout_seconds,
                    "active_products": product_count,
                    "probe_ok": probe_ok,
                    "probe_message": probe_message,
                    "latency_ms": latency_ms,
                    "window_hours": window_hours,
                    "recent_transactions": total,
                    "recent_success": success,
                    "recent_failed": failed,
                    "recent_pending": pending,
                    "success_rate_pct": success_rate,
                }
            )

        unhealthy = [
            p
            for p in payload
            if (p["latency_ms"] is not None and p["latency_ms"] > 6000)
            or (p["success_rate_pct"] is not None and p["success_rate_pct"] < 80)
            or (p["status"] == Provider.Status.ACTIVE and not p["probe_ok"])
        ]
        return Response({"providers": payload, "unhealthy_count": len(unhealthy)})


class ProviderAutoFailoverView(APIView):
    """Auto-disable unhealthy providers by setting status=MAINTENANCE."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        max_latency_ms = int(request.data.get("max_latency_ms", 6000))
        min_success_rate_pct = float(request.data.get("min_success_rate_pct", 80))
        apply_changes = bool(request.data.get("apply", False))
        window_hours = int(request.data.get("window_hours", 24))
        period_start = timezone.now() - timezone.timedelta(hours=max(1, min(window_hours, 168)))

        providers = Provider.objects.filter(status=Provider.Status.ACTIVE).order_by("id")
        candidates = []
        for provider in providers:
            tx_qs = Transaction.objects.filter(
                created_at__gte=period_start,
                provider_request__provider=provider.slug,
            )
            total = tx_qs.count()
            success = tx_qs.filter(status=TransactionStatus.SUCCESS).count()
            success_rate = round((success / total * 100), 2) if total else None
            unhealthy = success_rate is not None and success_rate < min_success_rate_pct
            candidates.append(
                {
                    "id": provider.id,
                    "slug": provider.slug,
                    "name": provider.name,
                    "total": total,
                    "success_rate_pct": success_rate,
                    "should_disable": unhealthy,
                }
            )

        to_disable = [c for c in candidates if c["should_disable"]]
        active_count = providers.count()
        if active_count - len(to_disable) < 1:
            to_disable = to_disable[:-1] if to_disable else []

        changed = []
        if apply_changes:
            for item in to_disable:
                Provider.objects.filter(id=item["id"]).update(status=Provider.Status.MAINTENANCE)
                changed.append(item["slug"])

        return Response(
            {
                "success": True,
                "apply": apply_changes,
                "max_latency_ms": max_latency_ms,
                "min_success_rate_pct": min_success_rate_pct,
                "candidates": candidates,
                "disabled": changed,
            }
        )
