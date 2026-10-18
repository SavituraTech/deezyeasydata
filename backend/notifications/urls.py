from django.urls import path

from .views import (
    NotificationListView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
    NotificationPreferenceView,
    AdminBroadcastNotificationView,
)

urlpatterns = [
    path("", NotificationListView.as_view(), name="notification_list"),
    path("<int:pk>/read/", NotificationMarkReadView.as_view(), name="notification_read"),
    path("read-all/", NotificationMarkAllReadView.as_view(), name="notification_read_all"),
    path("preferences/", NotificationPreferenceView.as_view(), name="notification_prefs"),
    path("admin/broadcast/", AdminBroadcastNotificationView.as_view(), name="notification_admin_broadcast"),
]

