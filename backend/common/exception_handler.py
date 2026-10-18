"""
Custom exception handler for consistent API responses.
Parity with dbn-backend/apps/common/exceptions.custom_exception_handler.
"""

from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    from common.exceptions import BaseAppException

    response = exception_handler(exc, context)

    if response is None:
        if isinstance(exc, BaseAppException):
            return Response(
                {"success": False, "error": {"code": exc.error_code, "message": exc.message}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {"success": False, "error": {"code": "INTERNAL_ERROR", "message": str(exc) or "An internal error occurred"}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    custom_response = {
        "success": False,
        "error": {
            "code": "VALIDATION_ERROR" if response.status_code == 400 else "ERROR",
            "message": "Validation failed" if response.status_code == 400 else "An error occurred",
            "details": response.data,
        },
    }
    if response.status_code == 401:
        custom_response["error"] = {"code": "UNAUTHORIZED", "message": "Authentication required"}
    elif response.status_code == 403:
        custom_response["error"] = {"code": "FORBIDDEN", "message": "Permission denied"}
    elif response.status_code == 404:
        custom_response["error"] = {"code": "NOT_FOUND", "message": "Resource not found"}
    # preserve DRF detail message when available
    if hasattr(exc, "detail"):
        detail = exc.detail
        if isinstance(detail, str):
            custom_response["error"]["message"] = detail
        elif isinstance(detail, dict) and "detail" in detail:
            custom_response["error"]["message"] = str(detail["detail"])

    response.data = custom_response
    return response
