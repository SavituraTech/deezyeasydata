from django.contrib import admin

from .models import Notification, NotificationPreference


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "title", "is_read", "created_at")
    list_filter = ("is_read", "created_at")
    search_fields = ("title", "message", "user__username", "user__email")


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "in_app", "email", "push", "updated_at")
    search_fields = ("user__username", "user__email")

