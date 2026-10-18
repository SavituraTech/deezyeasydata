from django.db import models


class WebhookEvent(models.Model):
    """
    Durable inbox for provider webhooks.

    The webhook view verifies the request, stores the event here and returns 200
    immediately; processing (including the confirm-API call) runs in the
    background and is retried with backoff. ``dedupe_key`` makes redeliveries of
    the same event a no-op.
    """

    class Status(models.TextChoices):
        RECEIVED = "RECEIVED", "Received"
        PROCESSING = "PROCESSING", "Processing"
        PROCESSED = "PROCESSED", "Processed"
        FAILED = "FAILED", "Failed"

    provider = models.CharField(max_length=32)
    dedupe_key = models.CharField(max_length=255, unique=True)
    event = models.CharField(max_length=100, blank=True)
    reference = models.CharField(max_length=255, db_index=True)
    payload = models.JSONField()
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.RECEIVED, db_index=True
    )
    attempts = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True)
    response_code = models.PositiveSmallIntegerField(null=True, blank=True)
    next_attempt_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.provider}:{self.event}:{self.reference} [{self.status}]"
