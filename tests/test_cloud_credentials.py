"""The saved device credential: storage, permissions, precedence, logout, and redaction.

Everything runs offline: HTTP goes through httpx.MockTransport and every credential lives in
a temporary folder (see conftest.py).
"""

from __future__ import annotations

import json
import os
import stat
from pathlib import Path

import pytest
from cloud_fakes import API, TOKEN
from typer.testing import CliRunner

from modelwrecker import cli
from modelwrecker.cloud import (
    CredentialError,
    DeviceCredential,
    credential_path,
    delete_credential,
    load_credential,
    save_credential,
)
from modelwrecker.cloud import credentials as creds_mod
from modelwrecker.security.redaction import redact_text

runner = CliRunner()


def test_credential_round_trip_and_permissions() -> None:
    path = save_credential(DeviceCredential(token=TOKEN, device_id="d1", project_id=None,
                                            api_url=API))
    assert path == credential_path()
    raw = json.loads(path.read_text(encoding="utf-8"))
    assert set(raw) == {"device_id", "project_id", "token", "api_url", "created_at"}
    assert raw["created_at"].endswith("Z")
    cred = load_credential()
    assert (cred.token, cred.device_id, cred.project_id, cred.api_url, cred.source) == (
        TOKEN, "d1", None, API, "file")
    if os.name != "nt":  # POSIX: owner-only. Windows ignores mode bits (best effort).
        assert stat.S_IMODE(path.stat().st_mode) == 0o600
        assert stat.S_IMODE(path.parent.stat().st_mode) == 0o700
    assert not list(path.parent.glob("*.tmp"))  # atomic write left no temp file
    assert TOKEN not in repr(cred) and TOKEN not in str(cred)


def test_env_token_takes_precedence(monkeypatch) -> None:
    save_credential(DeviceCredential(token="mwd_fileTokenAAAAAAAAAAAA", device_id="d1",
                                     api_url=API))
    monkeypatch.setenv("MODELWRECKER_DEVICE_TOKEN", TOKEN)
    cred = load_credential()
    assert cred.token == TOKEN and cred.source == "env" and cred.api_url == ""


def test_no_credential_and_logout(monkeypatch) -> None:
    assert load_credential() is None
    save_credential(DeviceCredential(token=TOKEN, device_id="d1", api_url=API))
    result = runner.invoke(cli.app, ["logout"])
    assert result.exit_code == 0
    assert not credential_path().exists()
    assert load_credential() is None
    assert delete_credential() is False


def test_malformed_credential_never_echoes_content() -> None:
    p = credential_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text('{"token": "' + TOKEN + '", oops', encoding="utf-8")
    with pytest.raises(CredentialError) as ei:
        load_credential()
    assert TOKEN not in str(ei.value)


def test_default_credential_path_per_platform(tmp_path) -> None:
    win = creds_mod.default_credential_path({"APPDATA": str(tmp_path / "Roaming")}, "win32")
    assert win == tmp_path / "Roaming" / "modelwrecker" / "device.json"
    xdg = creds_mod.default_credential_path({"XDG_CONFIG_HOME": str(tmp_path / "xdg")}, "linux")
    assert xdg == tmp_path / "xdg" / "modelwrecker" / "device.json"
    home = creds_mod.default_credential_path({}, "linux")
    assert home == Path.home() / ".config" / "modelwrecker" / "device.json"


def test_device_tokens_are_redacted_from_text() -> None:
    assert TOKEN not in redact_text(f"Authorization failed for {TOKEN}")
