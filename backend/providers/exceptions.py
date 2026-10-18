class ProviderException(Exception):
    """Base exception for provider errors."""
    pass

class ProviderFailedException(ProviderException):
    """Raised when the provider explicitly returns a failed status but HTTP 200."""
    pass

class ProviderTimeoutException(ProviderException):
    """Raised when the provider request times out."""
    pass

class ProviderAuthenticationException(ProviderException):
    """Raised for provider auth errors (e.g. invalid API key)."""
    pass
