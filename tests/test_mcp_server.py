"""The real MCP server: it exposes exactly the allowlist, and denials reach the client.

Each denial test also asserts the engine was never called, so a denied request can never
partially run an attack. See docs/security/mcp.md.
"""

from __future__ import annotations

import asyncio

import pytest
from mcp_fakes import spy_on_engine, write_config

from modelwrecker.config import Config
from modelwrecker.mcp.guardrails import TOOL_ARGUMENTS


@pytest.fixture
def engine(monkeypatch: pytest.MonkeyPatch) -> list[Config]:
    """Replace the shared engine with a spy. Records every config it is handed."""
    return spy_on_engine(monkeypatch)


def test_mcp_server_exposes_exactly_the_allowlist(tmp_path) -> None:
    from modelwrecker.mcp.server import build_server

    server = build_server(runs_dir=str(tmp_path / "runs"), config_dir=str(tmp_path))
    names = {t.name for t in asyncio.run(server.list_tools())}
    assert names == set(TOOL_ARGUMENTS)
    assert not ({"run_shell", "write_file", "http_request", "read_file"} & names)


def test_mcp_server_denials_reach_the_client(tmp_path, engine) -> None:
    """A real in-process MCP client round trip: denials are clear is_error results, not crashes."""
    from mcp import Client

    from modelwrecker.mcp.server import build_server

    write_config(tmp_path, authorized=False, name="unauth.yaml")
    write_config(tmp_path, name="ok.yaml")
    server = build_server(runs_dir=str(tmp_path / "runs"), config_dir=str(tmp_path))

    async def scenario() -> dict[str, tuple[bool, str]]:
        out: dict[str, tuple[bool, str]] = {}
        async with Client(server) as client:
            cases = {
                "unknown_tool": ("run_shell", {"command": "whoami"}),
                "override": ("run", {"config_path": "ok.yaml", "base_url": "http://10.0.0.1"}),
                "unauthorized": ("run", {"config_path": "unauth.yaml"}),
                "traversal": ("validate_config", {"config_path": "../../etc/passwd.yaml"}),
                "ok": ("run", {"config_path": "ok.yaml", "run_id": "srv-ok"}),
            }
            for label, (tool, args) in cases.items():
                res = await client.call_tool(tool, args)
                text = " ".join(getattr(c, "text", "") for c in res.content)
                out[label] = (res.is_error, text)
        return out

    out = asyncio.run(scenario())
    assert out["unknown_tool"][0] and "unknown_tool" in out["unknown_tool"][1]
    assert out["override"][0] and "unexpected_argument" in out["override"][1]
    assert out["unauthorized"][0] and "target_not_authorized" in out["unauthorized"][1]
    assert out["traversal"][0] and "path_out_of_scope" in out["traversal"][1]
    assert not out["ok"][0], out["ok"][1]
    assert len(engine) == 1  # only the authorized, in-scope run reached the engine
