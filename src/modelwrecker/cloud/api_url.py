"""Which cloud API URL the device token may be sent to.

A non-https base URL is refused unless the host is `localhost` or `127.0.0.1` (local Worker
development), so a token never travels in clear text or to a URL that carries credentials.
"""

from __future__ import annotations

import os
from urllib.parse import urlsplit

from .client_errors import InsecureUrlError

DEFAULT_API_URL = "https://app.aevrin.net/api/v1"
ENV_URL = "MODELWRECKER_CLOUD_URL"
_LOCAL_HOSTS = {"localhost", "127.0.0.1"}


def validate_api_url(url: str) -> str:
    """Return the base URL without a trailing slash, or raise if a token must not go there."""
    parts = urlsplit(url.strip())
    host = (parts.hostname or "").lower()
    if not host:
        raise InsecureUrlError(f"not a valid cloud API URL: {url!r}")
    if parts.username or parts.password:
        raise InsecureUrlError("the cloud API URL must not contain credentials")
    if parts.query or parts.fragment:
        raise InsecureUrlError("the cloud API URL must not contain a query or fragment")
    # plain http is for local Worker development only
    is_local_http = parts.scheme == "http" and host in _LOCAL_HOSTS
    if parts.scheme != "https" and not is_local_http:
        raise InsecureUrlError(
            f"refusing cloud API URL {url!r}: it must use https (http is allowed only for "
            "localhost or 127.0.0.1)"
        )
    return url.strip().rstrip("/")


def resolve_api_url(explicit: str | None = None) -> str:
    """The base URL to use: an explicit value, else MODELWRECKER_CLOUD_URL, else the default."""
    url = explicit or os.environ.get(ENV_URL, "").strip() or DEFAULT_API_URL
    return validate_api_url(url)
