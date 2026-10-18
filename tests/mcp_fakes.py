"""Shared helpers for the MCP harness tests: config files, the service, a clock, an engine spy."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from pathlib import Path

import pytest

from modelwrecker.config import Config
from modelwrecker.mcp.guardrails import GuardrailError
from modelwrecker.mcp.service import McpService
from modelwrecker.storage.store import RunStore

_ENDPOINTS = (
    "attacker: {protocol: openai_compatible, model: m, base_url: https://x}\n"
    "judge: {protocol: openai_compatible, model: m, base_url: https://x}\n"
)


def write_config(tmp_path: Path, *, authorized: bool = True, target: bool = True,
                 objectives: int = 1, extra: str = "", name: str = "cfg.yaml") -> str:
    """Write a small config file and return its path."""
    text = _ENDPOINTS
    if target:
        text += (
            "target: {protocol: openai_compatible, model: m, base_url: https://x, "
            f"authorized: {str(authorized).lower()}}}\n"
        )
    text += "objectives:\n" + "".join(
        f"  - {{title: t{i}, category: system_prompt_leak}}\n" for i in range(objectives)
    )
    text += extra
    config_path = tmp_path / name
    config_path.write_text(text, encoding="utf-8")
    return str(config_path)


def service_for(tmp_path: Path, **kwargs: object) -> McpService:
    return McpService(runs_dir=tmp_path / "runs", config_dir=tmp_path, **kwargs)


class FakeClock:
    def __init__(self) -> None:
        self.t = 1000.0

    def __call__(self) -> float:
        return self.t


def spy_on_engine(monkeypatch: pytest.MonkeyPatch) -> list[Config]:
    """Replace the shared engine with a spy. Records every config it is handed."""
    from modelwrecker.attacker import loop

    calls: list[Config] = []

    async def fake_run_config(cfg: Config, *, store: RunStore | None = None,
                              emit: object = None, run_id: str | None = None) -> loop.RunResult:
        calls.append(cfg)
        return loop.RunResult(run_id=run_id, objectives_run=len(cfg.objectives))

    monkeypatch.setattr(loop, "run_config", fake_run_config)
    return calls


def denied(code: str, fn: Callable[..., object], *args: object,
           **kwargs: object) -> GuardrailError:
    """Assert a (sync or async) call is refused with this exact code; return the error."""
    with pytest.raises(GuardrailError) as ei:
        out = fn(*args, **kwargs)
        if asyncio.iscoroutine(out):
            asyncio.run(out)
    assert ei.value.code == code, f"expected {code}, got {ei.value.code}: {ei.value}"
    return ei.value
