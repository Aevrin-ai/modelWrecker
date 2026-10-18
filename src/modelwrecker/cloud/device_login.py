"""Device sign-in (OAuth 2.0 device flow, RFC 8628): the typed replies and the polling loop."""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .client import CloudClient


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


# the RFC 8628 polling errors, by the `error` value the API sends
POLL_ERRORS = {status.value: status for status in TokenStatus if status is not TokenStatus.OK}


@dataclass
class LoginOutcome:
    status: TokenStatus  # OK, EXPIRED, or DENIED
    token: TokenResult | None = None


def poll_for_token(client: CloudClient, code: DeviceCode, *,
                   sleep: Callable[[float], None] = time.sleep,
                   clock: Callable[[], float] = time.monotonic) -> LoginOutcome:
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
