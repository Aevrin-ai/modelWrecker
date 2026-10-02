"""Device credential storage for cloud sync (ROADMAP 10.4 and 10.8).

The device token comes from the `MODELWRECKER_DEVICE_TOKEN` env var first (for CI), else from a
JSON file written by `modelwrecker login`:

- Linux and macOS: `$XDG_CONFIG_HOME/modelwrecker/device.json`
  (default `~/.config/modelwrecker/device.json`)
- Windows: `%APPDATA%\\modelwrecker\\device.json`

The file is written atomically with `0600` permissions (best effort on Windows). The token is never
logged or printed: `DeviceCredential.__repr__` hides it and `masked()` shows only a short prefix.
See docs/security/authentication.md and docs/decisions/ADR-0017-device-credential-model.md.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from ..security.redaction import redact_text

ENV_TOKEN = "MODELWRECKER_DEVICE_TOKEN"
FILE_NAME = "device.json"

# Tests point this at a temporary folder so they never touch a real credential.
_config_dir_override: Path | None = None


class CredentialError(ValueError):
    """The credential file exists but cannot be read or is malformed."""


@dataclass
class DeviceCredential:
    token: str = field(repr=False)
    device_id: str = ""
    project_id: str | None = None
    api_url: str = ""
    created_at: str = ""
    source: str = "file"  # file | env

    def masked(self) -> str:
        """A safe label for the token: the prefix only, never the secret part."""
        return (self.token[:4] + "****") if self.token.startswith("mwd_") else "****"

    def __repr__(self) -> str:  # never show the token, even in a traceback or a debugger
        return (f"DeviceCredential(device_id={self.device_id!r}, project_id={self.project_id!r}, "
                f"api_url={self.api_url!r}, token={self.masked()!r}, source={self.source!r})")

    def to_file_dict(self) -> dict:
        return {
            "device_id": self.device_id,
            "project_id": self.project_id,
            "token": self.token,
            "api_url": self.api_url,
            "created_at": self.created_at,
        }


def default_credential_path(
    env: dict[str, str] | None = None, platform: str | None = None
) -> Path:
    """Where `login` stores the credential on this platform."""
    env = dict(os.environ) if env is None else env
    platform = platform or sys.platform
    if platform.startswith("win"):
        root = env.get("APPDATA")
        base = Path(root) if root else Path.home() / "AppData" / "Roaming"
    else:
        root = env.get("XDG_CONFIG_HOME")
        base = Path(root) if root else Path.home() / ".config"
    return base / "modelwrecker" / FILE_NAME


def credential_path() -> Path:
    if _config_dir_override is not None:
        return Path(_config_dir_override) / FILE_NAME
    return default_credential_path()


def read_credential_file(path: Path | None = None) -> DeviceCredential | None:
    """Read the stored credential, or None when there is no file."""
    p = path or credential_path()
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        token = data["token"]
        if not isinstance(token, str) or not token:
            raise KeyError("token")
    except (OSError, ValueError, KeyError, TypeError) as e:
        # Never echo the file content: it may hold the token.
        raise CredentialError(f"the device credential at {p} is unreadable; run `modelwrecker "
                              "login` again") from e
    return DeviceCredential(
        token=token,
        device_id=str(data.get("device_id") or ""),
        project_id=data.get("project_id"),
        api_url=str(data.get("api_url") or ""),
        created_at=str(data.get("created_at") or ""),
        source="file",
    )


def load_credential(path: Path | None = None) -> DeviceCredential | None:
    """The active credential: the env token first, else the stored file, else None."""
    env_token = os.environ.get(ENV_TOKEN, "").strip()
    if env_token:
        try:
            stored = read_credential_file(path)
        except CredentialError:
            stored = None
        return DeviceCredential(
            token=env_token,
            device_id=stored.device_id if stored else "",
            project_id=stored.project_id if stored else None,
            api_url="",  # an env token goes to MODELWRECKER_CLOUD_URL or the default
            created_at=stored.created_at if stored else "",
            source="env",
        )
    return read_credential_file(path)


def save_credential(cred: DeviceCredential, path: Path | None = None) -> Path:
    """Write the credential atomically with owner-only permissions. Returns the path."""
    p = path or credential_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    _chmod(p.parent, 0o700)
    if not cred.created_at:
        cred.created_at = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    text = json.dumps(cred.to_file_dict(), indent=2)
    # mkstemp creates the file with 0600 already, so the token is never world-readable, not even
    # for a moment before the chmod.
    fd, tmp = tempfile.mkstemp(dir=str(p.parent), prefix=".device-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
        _chmod(Path(tmp), 0o600)
        os.replace(tmp, p)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    _chmod(p, 0o600)
    return p


def delete_credential(path: Path | None = None) -> bool:
    """Remove the stored credential. Returns True if a file was deleted."""
    p = path or credential_path()
    try:
        p.unlink()
    except FileNotFoundError:
        return False
    return True


def safe(text: str) -> str:
    """Scrub any device token that might appear in a message before it is shown."""
    return redact_text(text)


def _chmod(path: Path, mode: int) -> None:
    try:
        os.chmod(path, mode)
    except OSError:
        pass  # best effort (Windows ignores most mode bits)
