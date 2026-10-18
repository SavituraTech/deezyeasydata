from rest_framework import status
from rest_framework.response import Response

from providers.exceptions import ProviderFailedException, ProviderTimeoutException
from .strategy import InsufficientFundsError


class VendingResponseMixin:
    """
    Shared error/response mapping for vending-style endpoints.
    """

    def handle_vending_exceptions(self, exc: Exception) -> Response:
        if isinstance(exc, InsufficientFundsError):
            return Response(
                {"error": "INSUFFICIENT_FUNDS", "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if isinstance(exc, ProviderFailedException):
            return Response(
                {"error": "PROVIDER_FAILED", "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if isinstance(exc, ProviderTimeoutException):
            return Response(
                {"error": "PROVIDER_TIMEOUT", "message": str(exc)},
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        return Response(
            {
                "error": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

