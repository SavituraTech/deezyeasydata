from django.urls import path
from .webhooks import PaymentWebhookView, SMEPlugWebhookView, PayVesselWebhookView

urlpatterns = [
    path("payment/", PaymentWebhookView.as_view(), name="payment_webhook"),
    path("payvessel/webhook/", PayVesselWebhookView.as_view(), name="payvessel_webhook"),
    path("smeplug/webhook/", SMEPlugWebhookView.as_view(), name="smeplug_webhook"),
]
