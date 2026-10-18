from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from common.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification, NotificationPreference
from .serializers import NotificationSerializer, NotificationPreferenceSerializer
from django.contrib.auth import get_user_model
from django.db.models import Sum, Count
from decimal import Decimal
from datetime import timedelta


class NotificationListView(generics.ListAPIView):
    """List notifications for the current user. Paginated via DRF default (20/page)."""
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def post(self, request, pk):
        notification = Notification.objects.filter(user=request.user, pk=pk).first()
        if not notification:
            return Response(
                {"error": "Notification not found."}, status=status.HTTP_404_NOT_FOUND
            )
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=["is_read", "read_at"])
        return Response({"success": True})


class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        return Response({"success": True})


class NotificationPreferenceView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationPreferenceSerializer

    @extend_schema(responses=NotificationPreferenceSerializer)
    def get(self, request):
        pref, _ = NotificationPreference.objects.get_or_create(user=request.user)
        return Response(NotificationPreferenceSerializer(pref).data)

    @extend_schema(
        request=NotificationPreferenceSerializer, responses=NotificationPreferenceSerializer
    )
    def patch(self, request):
        pref, _ = NotificationPreference.objects.get_or_create(user=request.user)
        serializer = NotificationPreferenceSerializer(
            pref, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AdminBroadcastNotificationView(APIView):
    """Broadcast/targeted in-app notification sender for admins."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        title = str(request.data.get("title", "")).strip()
        message = str(request.data.get("message", "")).strip()
        segment = str(request.data.get("segment", "all")).strip().lower()
        threshold = Decimal(str(request.data.get("threshold", "0") or "0"))

        if not title or not message:
            return Response(
                {"error": "title and message are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        User = get_user_model()
        qs = User.objects.filter(is_active=True)
        now = timezone.now()

        if segment == "inactive":
            qs = qs.filter(last_login__lt=now - timedelta(days=30)) | qs.filter(
                last_login__isnull=True
            )
        elif segment == "high_spenders":
            qs = (
                qs.annotate(total_spend=Sum("transactions__amount"))
                .filter(total_spend__gte=threshold if threshold > 0 else Decimal("100000"))
                .order_by("-total_spend")
            )
        elif segment == "top_buyers":
            qs = qs.annotate(txn_count=Count("transactions")).filter(
                txn_count__gte=int(request.data.get("min_transactions", 5) or 5)
            )
        elif segment == "all":
            pass
        else:
            return Response(
                {"error": "Invalid segment. Use all, inactive, high_spenders, or top_buyers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        users = list(qs.distinct())
        if not users:
            return Response({"success": True, "sent": 0, "message": "No users in selected segment."})

        batch = [
            Notification(
                user=user,
                title=title,
                message=message,
                metadata={
                    "source": "admin_broadcast",
                    "segment": segment,
                },
            )
            for user in users
        ]
        Notification.objects.bulk_create(batch, batch_size=1000)
        return Response({"success": True, "sent": len(batch), "segment": segment})

