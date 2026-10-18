"""MCP path scope: config paths and run ids stay inside their allowed directories.

Each denial test also asserts the engine was never called, so a denied request can never
partially run an attack. See docs/security/mcp.md.
"""

from __future__ import annotations

import asyncio

import pytest
from mcp_fakes import denied, service_for, spy_on_engine, write_config

from modelwrecker.config import Config
from modelwrecker.mcp.service import McpService
from modelwrecker.storage.store import RunStore


@pytest.fixture
def engine(monkeypatch: pytest.MonkeyPatch) -> list[Config]:
    """Replace the shared engine with a spy. Records every config it is handed."""
    return spy_on_engine(monkeypatch)


def test_config_path_traversal_rejected(tmp_path, engine) -> None:
    base = tmp_path / "configs"
    base.mkdir()
    svc = McpService(runs_dir=tmp_path / "runs", config_dir=base)
    # A real, valid, authorized config OUTSIDE the allowed directory: only path scope stops it.
    outside = write_config(tmp_path, name="outside.yaml")
    for bad in ("../outside.yaml", outside, "sub/../../outside.yaml"):
        denied("path_out_of_scope", svc.run, bad)
        denied("path_out_of_scope", svc.validate_config, bad)
    # Not a local yaml file.
    fake_key = "sk-" + "abcdefghijklmnopqrstuvwxyz"
    (base / "secrets.txt").write_text(f"api_key: {fake_key}", encoding="utf-8")
    for bad in ("secrets.txt", "http://evil.example/cfg.yaml", "", "a\x00.yaml"):
        denied("invalid_path", svc.validate_config, bad)
    denied("config_not_found", svc.run, "missing.yaml")
    assert engine == []
    # Calibration: the same config inside the allowed directory is accepted.
    write_config(base, name="inside.yaml")
    assert asyncio.run(svc.run("inside.yaml"))["objectives_run"] == 1


def test_symlink_escape_rejected(tmp_path, engine) -> None:
    base = tmp_path / "configs"
    base.mkdir()
    outside = write_config(tmp_path, name="outside.yaml")
    try:
        (base / "link.yaml").symlink_to(outside)
    except OSError:
        pytest.skip("symlinks not permitted on this machine")
    svc = McpService(runs_dir=tmp_path / "runs", config_dir=base)
    denied("path_out_of_scope", svc.run, "link.yaml")
    assert engine == []


def test_run_id_traversal_rejected(tmp_path, engine) -> None:
    svc = service_for(tmp_path)
    cfg = write_config(tmp_path)
    for bad in ("../secrets", "..", "a/b", "a\\b", ".hidden", "", "c:evil", "x" * 200):
        denied("invalid_id", svc.get_findings, bad)
        denied("invalid_id", svc.run, cfg, run_id=bad)
    RunStore(run_id="r1", base_dir=str(tmp_path / "runs"))
    denied("invalid_id", svc.replay, "r1", "../../cfg")
    denied("not_found", svc.get_findings, "no-such-run")
    denied("run_exists", svc.run, cfg, run_id="r1")  # never overwrite an existing run
    assert engine == []
