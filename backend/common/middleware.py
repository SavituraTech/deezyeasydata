import logging
import threading

_client_source = threading.local()
VALID_SOURCES = frozenset({"mobile", "web", "api"})


class RequestSourceFilter(logging.Filter):
    """Logging filter that adds `client_source` to every log record."""

    def filter(self, record):
        record.client_source = getattr(_client_source, "value", "api")
        return True


class RequestSourceMiddleware:
    """
    Reads X-Client-Source header and sets request.client_source + request.source.
    Also injects thread-local for logging parity with dbn-backend.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        raw = request.META.get("HTTP_X_CLIENT_SOURCE", "api").lower().strip()
        source = raw if raw in VALID_SOURCES else "api"
        request.client_source = source
        request.source = source
        _client_source.value = source
        response = self.get_response(request)
        _client_source.value = "api"
        return response
