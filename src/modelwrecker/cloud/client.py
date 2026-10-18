"""A small HTTP client for the cloud control-plane API (docs/architecture/control-plane-api.md).

It speaks five routes only: `device/code`, `device/token`, `device/heartbeat`, `device/entitlement`,
and `sync`. A signed entitlement in a heartbeat or entitlement reply is verified and stored. It
never follows redirects (a redirect could carry the device token to another host), uses short
timeouts, and sends the token only to a URL that `api_url.validate_api_url` accepts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import httpx

from .. import __version__
from .api_responses import error_from, read_json
from .api_url import DEFAULT_API_URL, ENV_URL, resolve_api_url, validate_api_url
from .client_errors import CloudError, InsecureUrlError
from .device_login import (
    POLL_ERRORS,
    DeviceCode,
    LoginOutcome,
    TokenResult,
    TokenStatus,
    poll_for_token,
)
from .policy import SyncPolicy

if TYPE_CHECKING:
    from ..entitlements import Entitlement

# re-exported: these lived in this module before it was split, and callers import them from here
__all__ = [
    "DEFAULT_API_URL",
    "ENV_URL",
    "CloudClient",
    "CloudError",
    "DeviceCode",
    "InsecureUrlError",
    "LoginOutcome",
    "TokenResult",
    "TokenStatus",
    "poll_for_token",
    "resolve_api_url",
    "validate_api_url",
]

_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


class CloudClient:
    """Synchronous client. Pass `transport` in tests (httpx.MockTransport); never a live network."""

    def __init__(self, api_url: str | None = None, token: str | None = None, *,
                 transport: httpx.BaseTransport | None = None,
                 timeout: httpx.Timeout | float = _TIMEOUT) -> None:
        self.api_url = resolve_api_url(api_url)
        self._token = token
        self._http = httpx.Client(
            base_url=self.api_url,
            timeout=timeout,
            follow_redirects=False,
            transport=transport,
            headers={"User-Agent": f"modelwrecker/{__version__}", "Accept": "application/json"},
        )

    def __enter__(self) -> CloudClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def close(self) -> None:
        self._http.close()

    def device_code(self, *, name: str, os_name: str,
                    engine_version: str = __version__) -> DeviceCode:
        data = self._post("device/code", {"name": name, "os": os_name,
                                          "engine_version": engine_version})
        try:
            return DeviceCode(
                device_code=str(data["device_code"]),
                user_code=str(data["user_code"]),
                verification_uri=str(data["verification_uri"]),
                verification_uri_complete=str(data.get("verification_uri_complete")
                                              or data["verification_uri"]),
                expires_in=int(data.get("expires_in", 900)),
                interval=max(1, int(data.get("interval", 5))),
            )
        except (KeyError, TypeError, ValueError) as e:
            raise CloudError("bad_response", "the device code response was malformed") from e

    def device_token(self, device_code: str) -> TokenResult:
        """One poll. Returns a typed status for the RFC 8628 errors; raises CloudError otherwise."""
        resp = self._send("device/token", {"device_code": device_code}, auth=False)
        if resp.status_code == 200:
            data = read_json(resp)
            token = data.get("device_token")
            if not isinstance(token, str) or not token:
                raise CloudError("bad_response", "the token response had no device token", 200)
            return TokenResult(TokenStatus.OK, device_token=token,
                               device_id=str(data.get("device_id") or ""),
                               project_id=data.get("project_id"))
        if resp.status_code == 400:
            code = read_json(resp).get("error")
            if isinstance(code, str) and code in POLL_ERRORS:
                return TokenResult(POLL_ERRORS[code])
        raise error_from(resp)

    def heartbeat(self, engine_version: str = __version__) -> bool:
        data = self._post("device/heartbeat", {"engine_version": engine_version}, auth=True)
        _remember_entitlement(data)
        return bool(data.get("ok"))

    def sync_policy(self, engine_version: str = __version__) -> SyncPolicy:
        """Heartbeat, and read which detail the account allows. An older API means metadata only."""
        data = self._post("device/heartbeat", {"engine_version": engine_version}, auth=True)
        _remember_entitlement(data)
        return SyncPolicy.from_api(data.get("sync"))

    def refresh_entitlement(self) -> Entitlement:
        """Fetch, verify, and store a fresh signed entitlement. Returns it, or raises."""
        from ..entitlements import EntitlementError, save_token

        resp = self._request("GET", "device/entitlement", headers=self._auth_headers())
        if resp.status_code != 200:
            raise error_from(resp)
        token = read_json(resp).get("entitlement")
        if not isinstance(token, str) or not token:
            raise CloudError("bad_response", "the entitlement response had no token", 200)
        try:
            return save_token(token)
        except EntitlementError as e:
            raise CloudError("invalid_entitlement", str(e), 200) from e

    def sync(self, body: dict) -> dict:
        """POST one run summary. Returns the 200 body; raises CloudError on anything else."""
        data = self._post("sync", body, auth=True)
        if not data.get("ok"):
            raise CloudError("bad_response", "the sync response did not confirm ok", 200)
        return data

    def _post(self, path: str, body: dict, *, auth: bool = False) -> dict:
        resp = self._send(path, body, auth=auth)
        if resp.status_code != 200:
            raise error_from(resp)
        return read_json(resp)

    def _send(self, path: str, body: dict, *, auth: bool) -> httpx.Response:
        headers = self._auth_headers() if auth else {}
        return self._request("POST", path, json=body, headers=headers)

    def _auth_headers(self) -> dict[str, str]:
        if not self._token:
            raise CloudError("not_logged_in", "no device credential; run `modelwrecker login`")
        return {"Authorization": f"Bearer {self._token}"}

    def _request(self, method: str, path: str, **kwargs: object) -> httpx.Response:
        try:
            resp = self._http.request(method, path, **kwargs)
        except httpx.TimeoutException as e:
            raise CloudError("timeout", "the cloud API did not answer in time") from e
        except httpx.HTTPError as e:
            raise CloudError("network_error",
                             f"could not reach the cloud API: {type(e).__name__}") from e
        if resp.is_redirect:
            raise CloudError("redirect_refused",
                             "the cloud API answered with a redirect; not followed",
                             resp.status_code)
        return resp


def _remember_entitlement(data: dict) -> None:
    """Store a signed entitlement from a heartbeat reply.

    A token that fails verification is ignored: the engine keeps what it had, or the free baseline.
    """
    token = data.get("entitlement")
    if not isinstance(token, str) or not token:
        return
    from ..entitlements import EntitlementError, save_token

    try:
        save_token(token)
    except (EntitlementError, OSError):
        # a bad or unsavable token must never break a heartbeat; the stored one stays in force
        return
