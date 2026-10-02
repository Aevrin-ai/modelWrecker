"""A small HTTP client for the cloud control-plane API (docs/architecture/control-plane-api.md).

It speaks five routes only: `device/code`, `device/token`, `device/heartbeat`, `device/entitlement`,
and `sync`. A signed entitlement in a heartbeat or entitlement reply is verified and stored (issue
#11). It never follows redirects (a redirect could carry the device token to another host), uses
short timeouts, and refuses a non-https base URL unless the host is `localhost` or `127.0.0.1`
(local Worker development). RFC 8628 polling errors are mapped to a typed `TokenStatus`.
"""

from __future__ import annotations

import os
import time
from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from urllib.parse import urlsplit

import httpx

from .. import __version__
from ..security.redaction import redact_text
from .policy import SyncPolicy

DEFAULT_API_URL = "https://app.aevrin.net/api/v1"
ENV_URL = "MODELWRECKER_CLOUD_URL"
_LOCAL_HOSTS = {"localhost", "127.0.0.1"}
_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


class CloudError(Exception):
    """A call to the cloud API failed. `status` is None for network failures."""

    def __init__(self, code: str, message: str = "", status: int | None = None) -> None:
        self.code = code
        self.status = status
        self.message = redact_text(message or code)
        super().__init__(self.message)

    @property
    def refused(self) -> bool:
        """True when the API answered and said no (a 4xx other than rate limiting or timeout).

        A network failure, a 5xx, a 408, or a 429 means "try again later", not a refusal.
        """
        s = self.status
        return s is not None and 400 <= s < 500 and s not in (408, 429)


class InsecureUrlError(CloudError):
    def __init__(self, message: str) -> None:
        super().__init__("insecure_url", message)


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
    if parts.scheme == "https":
        pass
    elif parts.scheme == "http" and host in _LOCAL_HOSTS:
        pass  # local Worker development only
    else:
        raise InsecureUrlError(
            f"refusing cloud API URL {url!r}: it must use https (http is allowed only for "
            "localhost or 127.0.0.1)"
        )
    return url.strip().rstrip("/")


def resolve_api_url(explicit: str | None = None) -> str:
    """The base URL to use: an explicit value, else MODELWRECKER_CLOUD_URL, else the default."""
    url = explicit or os.environ.get(ENV_URL, "").strip() or DEFAULT_API_URL
    return validate_api_url(url)


# --- typed results -------------------------------------------------------------------------------


@dataclass
class DeviceCode:
    device_code: str
    user_code: str
    verification_uri: str
    verification_uri_complete: str
    expires_in: int
    interval: int

    def __repr__(self) -> str:  # the device code is a bearer secret until it is used
        return f"DeviceCode(user_code={self.user_code!r}, expires_in={self.expires_in})"


class TokenStatus(StrEnum):
    OK = "ok"
    PENDING = "authorization_pending"
    SLOW_DOWN = "slow_down"
    EXPIRED = "expired_token"
    DENIED = "access_denied"


@dataclass
class TokenResult:
    status: TokenStatus
    device_token: str = ""
    device_id: str = ""
    project_id: str | None = None

    def __repr__(self) -> str:
        return f"TokenResult(status={self.status.value!r}, device_id={self.device_id!r})"


_POLL_ERRORS = {s.value: s for s in TokenStatus if s is not TokenStatus.OK}


# --- client --------------------------------------------------------------------------------------


class CloudClient:
    """Synchronous client. Pass `transport` in tests (httpx.MockTransport); never a live network."""

    def __init__(
        self,
        api_url: str | None = None,
        token: str | None = None,
        *,
        transport: httpx.BaseTransport | None = None,
        timeout: httpx.Timeout | float = _TIMEOUT,
    ) -> None:
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

    # public routes -----------------------------------------------------------------------------

    def device_code(
        self, *, name: str, os_name: str, engine_version: str = __version__
    ) -> DeviceCode:
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
            data = _json(resp)
            token = data.get("device_token")
            if not isinstance(token, str) or not token:
                raise CloudError("bad_response", "the token response had no device token", 200)
            return TokenResult(TokenStatus.OK, device_token=token,
                               device_id=str(data.get("device_id") or ""),
                               project_id=data.get("project_id"))
        if resp.status_code == 400:
            code = _json(resp).get("error")
            if isinstance(code, str) and code in _POLL_ERRORS:
                return TokenResult(_POLL_ERRORS[code])
        raise _error_from(resp)

    # device routes -----------------------------------------------------------------------------

    def heartbeat(self, engine_version: str = __version__) -> bool:
        data = self._post("device/heartbeat", {"engine_version": engine_version}, auth=True)
        _remember_entitlement(data)
        return bool(data.get("ok"))

    def sync_policy(self, engine_version: str = __version__) -> SyncPolicy:
        """Heartbeat, and read which detail the account allows. An older API means metadata only."""
        data = self._post("device/heartbeat", {"engine_version": engine_version}, auth=True)
        _remember_entitlement(data)
        return SyncPolicy.from_api(data.get("sync"))

    def refresh_entitlement(self):
        """Fetch, verify, and store a fresh signed entitlement. Returns it, or raises."""
        from ..entitlements import EntitlementError, save_token

        resp = self._send_get("device/entitlement")
        if resp.status_code != 200:
            raise _error_from(resp)
        token = _json(resp).get("entitlement")
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

    # plumbing ----------------------------------------------------------------------------------

    def _post(self, path: str, body: dict, *, auth: bool = False) -> dict:
        resp = self._send(path, body, auth=auth)
        if resp.status_code != 200:
            raise _error_from(resp)
        return _json(resp)

    def _send_get(self, path: str) -> httpx.Response:
        if not self._token:
            raise CloudError("not_logged_in", "no device credential; run `modelwrecker login`")
        try:
            resp = self._http.get(path, headers={"Authorization": f"Bearer {self._token}"})
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

    def _send(self, path: str, body: dict, *, auth: bool) -> httpx.Response:
        headers = {}
        if auth:
            if not self._token:
                raise CloudError("not_logged_in", "no device credential; run `modelwrecker login`")
            headers["Authorization"] = f"Bearer {self._token}"
        try:
            resp = self._http.post(path, json=body, headers=headers)
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
        pass


def _json(resp: httpx.Response) -> dict:
    try:
        data = resp.json()
    except ValueError as e:
        raise CloudError("bad_response", "the cloud API returned non-JSON", resp.status_code) from e
    if not isinstance(data, dict):
        raise CloudError("bad_response", "the cloud API returned an unexpected shape",
                         resp.status_code)
    return data


def _error_from(resp: httpx.Response) -> CloudError:
    code, message = f"http_{resp.status_code}", ""
    try:
        data = resp.json()
        if isinstance(data, dict):
            code = str(data.get("error") or code)[:64]
            message = str(data.get("message") or "")[:300]
    except ValueError:
        pass
    return CloudError(code, message or f"the cloud API returned HTTP {resp.status_code}",
                      resp.status_code)


# --- device login polling ------------------------------------------------------------------------


@dataclass
class LoginOutcome:
    status: TokenStatus  # OK, EXPIRED, or DENIED
    token: TokenResult | None = None


def poll_for_token(
    client: CloudClient,
    code: DeviceCode,
    *,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
) -> LoginOutcome:
    """Poll `device/token` until approved, denied, or expired (RFC 8628 section 3.5).

    Waits `interval` seconds before every poll and adds 5 seconds on each `slow_down`.
    """
    interval = max(1, code.interval)
    deadline = clock() + max(1, code.expires_in)
    while True:
        if clock() + interval > deadline:
            return LoginOutcome(TokenStatus.EXPIRED)
        sleep(interval)
        result = client.device_token(code.device_code)
        if result.status is TokenStatus.OK:
            return LoginOutcome(TokenStatus.OK, result)
        if result.status in (TokenStatus.EXPIRED, TokenStatus.DENIED):
            return LoginOutcome(result.status)
        if result.status is TokenStatus.SLOW_DOWN:
            interval += 5
