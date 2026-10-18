import hashlib
import json
import logging
from datetime import timedelta
from django.http import JsonResponse
from django.utils import timezone
from .models import IdempotencyKey

logger = logging.getLogger(__name__)

# How long an in-flight key (no response yet) is considered live before we
# assume the original request died and let a new attempt proceed.
STALE_INFLIGHT_SECONDS = 300


def _extract_user_id(request) -> int | None:
    """Best-effort extraction of user_id from the JWT in the Authorization header.
    Returns None if unauthenticated or parsing fails — the middleware will still
    work but won't scope the key to a specific user.
    """
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        import jwt
        token = auth.split(" ", 1)[1]
        # Decode without verification (we only need the user_id claim;
        # DRF will verify the token later).
        payload = jwt.decode(token, options={"verify_signature": False}, algorithms=["HS256"])
        return payload.get("user_id")
    except Exception:
        return None


def _scope_key(raw_key: str, user_id: int | None) -> str:
    """Scope the idempotency key to the authenticated user so different users
    cannot replay each other's requests.
    """
    if user_id is None:
        return raw_key
    return hashlib.sha256(f"{raw_key}:{user_id}".encode()).hexdigest()


class IdempotencyMiddleware:
    """
    Middleware that intercepts requests with an Idempotency-Key header.
    If the key exists and has a cached response, it immediately returns the cached response.
    If the key doesn't exist, it creates a placeholder.
    After the view processes the request, it saves the response to the key.

    Keys are scoped to the authenticated user (via SHA-256 hash of raw_key:user_id)
    so that different users cannot replay each other's cached responses.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method != 'POST':
            return self.get_response(request)

        raw_idem_key = request.META.get('HTTP_IDEMPOTENCY_KEY')
        if not raw_idem_key:
            return self.get_response(request)

        # Scope key to the authenticated user to prevent cross-user replay.
        user_id = _extract_user_id(request)
        idem_key = _scope_key(raw_idem_key, user_id)

        key_obj, created = IdempotencyKey.objects.get_or_create(
            key=idem_key,
            defaults={'user_id': user_id, 'path': request.path}
        )

        if not created:
            if key_obj.path != request.path:
                logger.warning(
                    "Idempotency key path mismatch | key=%.16s expected=%s got=%s",
                    idem_key, key_obj.path, request.path,
                )
                return JsonResponse({"error": "Idempotency key mismatch"}, status=400)

            if key_obj.has_response:
                logger.debug(
                    "Idempotency cache hit | key=%.16s path=%s status=%s",
                    idem_key, request.path, key_obj.response_code,
                )
                return JsonResponse(
                    key_obj.response_body,
                    status=key_obj.response_code,
                    safe=False,
                )

            # In-flight: if it's been sitting too long without a response,
            # the original attempt likely crashed — reclaim it.
            age = timezone.now() - key_obj.created_at
            if age.total_seconds() > STALE_INFLIGHT_SECONDS:
                logger.warning(
                    "Stale in-flight idempotency key reclaimed | key=%.16s path=%s age_seconds=%.0f",
                    idem_key, request.path, age.total_seconds(),
                )
                key_obj.created_at = timezone.now()
                key_obj.save(update_fields=['created_at'])
            else:
                logger.debug(
                    "Idempotency key in-flight, rejecting duplicate | key=%.16s path=%s",
                    idem_key, request.path,
                )
                return JsonResponse(
                    {"error": "Request is currently processing"},
                    status=409,
                )

        response = self.get_response(request)

        # Cache the rendered JSON body (works for DRF Response and JsonResponse).
        content_type = response.get('Content-Type', '') if hasattr(response, 'get') else ''
        if (
            'application/json' in content_type
            and getattr(response, 'status_code', 500) < 500
            and getattr(response, 'content', None)
        ):
            try:
                body = json.loads(response.content.decode('utf-8'))
            except (ValueError, UnicodeDecodeError):
                body = None
            if body is not None:
                key_obj.response_code = response.status_code
                key_obj.response_body = body
                key_obj.has_response = True
                key_obj.save(update_fields=['response_code', 'response_body', 'has_response'])
                logger.debug(
                    "Idempotency response cached | key=%.16s path=%s status=%s",
                    idem_key, request.path, response.status_code,
                )

        return response

    @staticmethod
    def cleanup_stale_keys(older_than_hours: int = 48) -> int:
        """Optional helper: delete cached keys older than the given window."""
        cutoff = timezone.now() - timedelta(hours=older_than_hours)
        deleted, _ = IdempotencyKey.objects.filter(created_at__lt=cutoff).delete()
        return deleted
