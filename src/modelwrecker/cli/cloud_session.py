"""How the CLI reaches the cloud API: the client factory, saved credentials, and the poll sleep.

Tests replace `_make_cloud_client` and `_sleep` on this module, so callers in other modules look
them up here at call time (`cloud_session._make_cloud_client(...)`), never with a from-import.
"""

from __future__ import annotations

import os
import time
from typing import TYPE_CHECKING

import typer

if TYPE_CHECKING:
    from ..cloud import CloudClient, DeviceCredential

# tests replace this so device sign-in polling does not really wait
_sleep = time.sleep


def _make_cloud_client(api_url: str | None, token: str | None) -> CloudClient:
    """Build the cloud API client. Tests replace this to inject an offline transport."""
    from ..cloud import CloudClient

    return CloudClient(api_url, token)


def default_device_name() -> str:
    """The device name shown in the dashboard when `login --name` is not given."""
    import socket

    try:
        return socket.gethostname() or "modelwrecker device"
    except OSError:
        return "modelwrecker device"


def load_credential_or_exit() -> DeviceCredential | None:
    """The saved credential, or None when there is none. An unreadable one exits with code 2."""
    from ..cloud import CredentialError, load_credential

    try:
        return load_credential()
    except CredentialError as e:
        typer.secho(f"error: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=2) from e


def load_credential_quietly() -> DeviceCredential | None:
    """The saved credential, or None if there is none or it can not be read (for --dry-run)."""
    from ..cloud import CredentialError, load_credential

    try:
        return load_credential()
    except CredentialError:
        return None


def sync_client(cred: DeviceCredential) -> CloudClient:
    """A client for device routes. A saved credential only talks to the URL it was issued for."""
    from ..cloud import ENV_URL, CloudError, validate_api_url

    env_url = os.environ.get(ENV_URL, "").strip()
    if cred.source == "file" and cred.api_url:
        if env_url and validate_api_url(env_url) != validate_api_url(cred.api_url):
            raise CloudError(
                "url_mismatch",
                f"this device was registered with {cred.api_url}, but {ENV_URL} points to "
                f"{env_url}. Run `modelwrecker login` again to register with the new URL.",
            )
        return _make_cloud_client(cred.api_url, cred.token)
    # an env token goes to MODELWRECKER_CLOUD_URL or the default URL
    return _make_cloud_client(None, cred.token)


def format_epoch(epoch: int) -> str:
    """An entitlement timestamp as people read it: 1767225600 -> 2026-01-01 00:00 UTC."""
    from datetime import UTC, datetime

    return datetime.fromtimestamp(epoch, UTC).strftime("%Y-%m-%d %H:%M UTC")
