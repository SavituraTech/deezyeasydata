import logging
import requests
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from django.conf import settings
from .exceptions import ProviderTimeoutException, ProviderException

logger = logging.getLogger(__name__)

# Sentinel — used to distinguish "caller passed nothing" from "caller passed None"
_UNSET = object()
_warned_empty_newdatasub_key = False


def _load_provider_record(slug: str):
    """
    Safely return a Provider DB record by slug.
    Returns None if the model hasn't been migrated yet (e.g. fresh checkout)
    or if no matching record exists.
    """
    try:
        from .models import Provider  # local import to avoid circular imports at startup
        return Provider.objects.filter(slug=slug, status=Provider.Status.ACTIVE).first()
    except Exception:
        logger.debug("Could not load Provider record for slug=%s (migrations may be pending)", slug)
        return None


class ProviderClient(ABC):
    """Abstract base class for all external provider clients."""

    @abstractmethod
    def make_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Send a request to the provider and return the raw JSON dict."""
        pass


class NewdatasubClient(ProviderClient):
    """
    Client for interacting with Newdatasub API.
    Handles pure HTTP communication and timeouts.

    Configuration priority (highest → lowest):
      1. Arguments passed directly to __init__   (explicit override)
      2. Active Provider DB record for slug='newdatasub'
      3. Django settings  (NEWDATASUB_API_KEY / NEWDATASUB_BASE_URL)
      4. Hard-coded defaults
    """

    SLUG = "newdatasub"
    DEFAULT_BASE_URL = "https://newdatasub.com/autobiz_vending_index.php"
    DEFAULT_TIMEOUT = 25

    def __init__(
        self,
        api_key: Optional[str] = _UNSET,
        base_url: Optional[str] = _UNSET,
        timeout: Optional[int] = _UNSET,
    ):
        db_record = _load_provider_record(self.SLUG)

        # api_key
        if api_key is not _UNSET:
            self.api_key = api_key or ""
        elif db_record:
            self.api_key = db_record.api_key  # reads from env-var at call time
        else:
            self.api_key = getattr(settings, "NEWDATASUB_API_KEY", "")

        # base_url
        if base_url is not _UNSET:
            self.base_url = base_url or self.DEFAULT_BASE_URL
        elif db_record:
            self.base_url = db_record.base_url
        else:
            self.base_url = getattr(settings, "NEWDATASUB_BASE_URL", self.DEFAULT_BASE_URL)

        # timeout
        if timeout is not _UNSET:
            self.timeout = timeout or self.DEFAULT_TIMEOUT
        elif db_record:
            self.timeout = db_record.timeout_seconds
        else:
            self.timeout = self.DEFAULT_TIMEOUT

        if db_record:
            logger.debug(
                "NewdatasubClient using DB config (provider pk=%s)", db_record.pk
            )
        else:
            logger.debug("NewdatasubClient using settings/default config")

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def make_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        headers = self._get_headers()
        body = dict(payload)
        if getattr(settings, "NEWDATASUB_INCLUDE_API_KEY_IN_JSON", False):
            body["api_key"] = self.api_key
        global _warned_empty_newdatasub_key
        if not (self.api_key or "").strip() and not _warned_empty_newdatasub_key:
            _warned_empty_newdatasub_key = True
            logger.warning(
                "Newdatasub API key is empty (NEWDATASUB_API_KEY / provider env). "
                "Requests will return errors until it is set."
            )
        action = body.get("action")
        try:
            logger.info("Newdatasub request | action=%s", action)

            response = requests.post(
                url=self.base_url,
                headers=headers,
                json=body,
                timeout=self.timeout,
            )

            try:
                resp_json = response.json()
            except ValueError:
                logger.error(
                    "Newdatasub non-JSON response | action=%s http_status=%s body=%.200s",
                    action, response.status_code, response.text,
                )
                resp_json = {
                    "status": False,
                    "raw_response": response.text,
                    "message": "Invalid JSON response from provider.",
                }

            if not resp_json.get("status"):
                data = resp_json.get("data")
                detail = None
                if isinstance(data, dict):
                    detail = data.get("true_response") or data.get("text_status")
                logger.warning(
                    "Newdatasub failure response | action=%s http_status=%s message=%s detail=%s",
                    action,
                    response.status_code,
                    resp_json.get("server_message") or resp_json.get("message"),
                    detail,
                )
            else:
                logger.debug("Newdatasub success | action=%s http_status=%s", action, response.status_code)

            return resp_json

        except requests.exceptions.Timeout:
            logger.error("Newdatasub timeout | action=%s timeout=%ss", action, self.timeout)
            raise ProviderTimeoutException("Provider request timed out.")
        except requests.exceptions.RequestException as e:
            logger.error("Newdatasub request error | action=%s error=%s", action, e)
            raise ProviderException(f"Provider request failed: {e}")



class SMEPlugClient(ProviderClient):
    """
    Client for interacting with the SMEPlug API.
    https://smeplug.ng/api/v1

    Configuration priority (highest -> lowest):
      1. Arguments passed directly to __init__
      2. Active Provider DB record for slug='smeplug'
      3. Django settings  (SMEPLUG_SECRET_KEY / SMEPLUG_BASE_URL)
      4. Hard-coded defaults

    The payload must include a '_endpoint' key (e.g. '/data/purchase')
    which is stripped before the HTTP call is made.
    """

    SLUG = "smeplug"
    DEFAULT_BASE_URL = "https://smeplug.ng/api/v1"
    DEFAULT_TIMEOUT = 25

    def __init__(
        self,
        api_key: Optional[str] = _UNSET,
        base_url: Optional[str] = _UNSET,
        timeout: Optional[int] = _UNSET,
    ):
        db_record = _load_provider_record(self.SLUG)

        if api_key is not _UNSET:
            self.api_key = api_key or ""
        elif db_record:
            self.api_key = db_record.api_key
        else:
            self.api_key = getattr(settings, "SMEPLUG_SECRET_KEY", "")

        if base_url is not _UNSET:
            self.base_url = base_url or self.DEFAULT_BASE_URL
        elif db_record:
            self.base_url = db_record.base_url
        else:
            self.base_url = getattr(settings, "SMEPLUG_BASE_URL", self.DEFAULT_BASE_URL)

        if timeout is not _UNSET:
            self.timeout = timeout or self.DEFAULT_TIMEOUT
        elif db_record:
            self.timeout = db_record.timeout_seconds
        else:
            self.timeout = self.DEFAULT_TIMEOUT

        if db_record:
            logger.debug("SMEPlugClient using DB config (provider pk=%s)", db_record.pk)
        else:
            logger.debug("SMEPlugClient using settings/default config")

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def make_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        POST to the SMEPlug API.
        Reads and strips '_endpoint' from payload to determine the URL path.
        """
        payload = dict(payload)
        endpoint = payload.pop("_endpoint", "/data/purchase")
        url = self.base_url.rstrip("/") + endpoint

        headers = self._get_headers()
        try:
            logger.info("SMEPlug request | endpoint=%s", endpoint)
            response = requests.post(
                url=url,
                headers=headers,
                json=payload,
                timeout=self.timeout,
            )

            try:
                resp_json = response.json()
            except ValueError:
                logger.error(
                    "SMEPlug non-JSON response | endpoint=%s http_status=%s body=%.200s",
                    endpoint, response.status_code, response.text,
                )
                resp_json = {
                    "status": False,
                    "raw_response": response.text,
                    "message": "Invalid JSON response from SMEPlug.",
                }

            if not resp_json.get("status"):
                logger.warning(
                    "SMEPlug failure response | endpoint=%s http_status=%s message=%s",
                    endpoint, response.status_code, resp_json.get("message"),
                )
            else:
                logger.debug("SMEPlug success | endpoint=%s http_status=%s", endpoint, response.status_code)

            return resp_json

        except requests.exceptions.Timeout:
            logger.error("SMEPlug timeout | endpoint=%s timeout=%ss", endpoint, self.timeout)
            raise ProviderTimeoutException("SMEPlug request timed out.")
        except requests.exceptions.RequestException as e:
            logger.error("SMEPlug request error | endpoint=%s error=%s", endpoint, e)
            raise ProviderException(f"SMEPlug request failed: {e}")
