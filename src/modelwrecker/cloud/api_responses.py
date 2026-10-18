"""Read cloud API replies: a JSON body, or a `CloudError` that describes a failed reply."""

from __future__ import annotations

import re

import httpx

from .client_errors import CloudError

# a UUID, or a Cloudflare ray id such as 8a1b2c3d4e5f6789-SIN; anything else is dropped
_REQUEST_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")


def read_json(resp: httpx.Response) -> dict:
    """The reply body as a dict, or a `bad_response` CloudError when it is not a JSON object."""
    try:
        data = resp.json()
    except ValueError as e:
        raise CloudError("bad_response", "the cloud API returned non-JSON", resp.status_code) from e
    if not isinstance(data, dict):
        raise CloudError("bad_response", "the cloud API returned an unexpected shape",
                         resp.status_code)
    return data


def error_from(resp: httpx.Response) -> CloudError:
    """A CloudError built from a failed reply's status, error code, message, and request id."""
    code, message = f"http_{resp.status_code}", ""
    request_id = _request_id(resp.headers.get("x-request-id"))
    try:
        data = resp.json()
    except ValueError:
        # a proxy's HTML error page: the HTTP status alone describes the failure
        data = None
    if isinstance(data, dict):
        code = str(data.get("error") or code)[:64]
        message = str(data.get("message") or "")[:300]
        request_id = _request_id(data.get("requestId")) or request_id
    return CloudError(code, message or f"the cloud API returned HTTP {resp.status_code}",
                      resp.status_code, request_id)


def _request_id(value: object) -> str | None:
    return value if isinstance(value, str) and _REQUEST_ID.match(value) else None
