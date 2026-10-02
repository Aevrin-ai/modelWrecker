"""The MCP server: wraps the safe service functions as MCP tools.

Built on the MCP Python SDK v2 (`MCPServer`, renamed from v1's `FastMCP`). Only the allowlisted
safe orchestration tools are exposed (no shell, file write, or arbitrary HTTP). Every tool call
passes the guardrail chain (docs/security/mcp.md): `call_tool` is overridden so the tool and
argument allowlist and the rate limit see the raw arguments before the SDK validates them, and each
tool body runs the deeper checks in the service. A denial comes back to the client as a clear
`is_error` result. Over local stdio no token is needed. Build it with build_server() (handy for
tests) and run it with main().
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from .guardrails import TOOL_ARGUMENTS, EntitlementChecker, GuardrailError, McpLimits
from .service import McpService


def build_server(
    runs_dir: str = "runs",
    config_dir: str = ".",
    *,
    limits: McpLimits | None = None,
    entitlements: EntitlementChecker | None = None,
):
    """Create the MCP server with modelWrecker's guarded tools (MCP SDK v2 `MCPServer`)."""
    from mcp.server.mcpserver import MCPServer
    from mcp.server.mcpserver.exceptions import ToolError

    service = McpService(
        runs_dir=runs_dir, config_dir=config_dir, limits=limits, entitlements=entitlements
    )

    @contextmanager
    def denials_as_tool_errors() -> Iterator[None]:
        # A ToolError reaches the client with its message; any other exception is hidden as a crash.
        try:
            yield
        except GuardrailError as e:
            raise ToolError(str(e)) from e

    class GuardedMCPServer(MCPServer):
        async def call_tool(self, name: str, arguments: dict[str, Any], context=None):
            with denials_as_tool_errors():
                service.admit(name, arguments)
            return await super().call_tool(name, arguments, context)

    mcp = GuardedMCPServer("modelwrecker")
    mcp.mw_service = service  # for tests and introspection

    @mcp.tool()
    def list_strategies() -> list[dict]:
        """List the attack strategies modelWrecker can run."""
        return service.list_strategies()

    @mcp.tool()
    def validate_config(config_path: str) -> dict:
        """Validate a modelWrecker config file inside the allowed config directory."""
        with denials_as_tool_errors():
            return service.validate_config(config_path)

    @mcp.tool()
    async def run(config_path: str, run_id: str | None = None) -> dict:
        """Run a config's objectives against its authorized target, within the MCP limits."""
        with denials_as_tool_errors():
            return await service.run(config_path, run_id=run_id)

    @mcp.tool()
    def get_findings(run_id: str) -> list[dict]:
        """Get the findings from a finished run."""
        with denials_as_tool_errors():
            return service.get_findings(run_id)

    @mcp.tool()
    def get_report(run_id: str) -> str:
        """Render a markdown report for a finished run."""
        with denials_as_tool_errors():
            return service.get_report(run_id)

    @mcp.tool()
    def replay(run_id: str, evidence_id: str) -> dict:
        """Return the reproduction payload and steps for a recorded finding."""
        with denials_as_tool_errors():
            return service.replay(run_id, evidence_id)

    registered = {t.name for t in mcp._tool_manager.list_tools()}
    if registered != set(TOOL_ARGUMENTS):  # the registry and the allowlist must never drift apart
        raise RuntimeError(f"MCP tools {sorted(registered)} do not match the allowlist")
    return mcp


def main() -> None:
    """Run the server over stdio (how an MCP client such as Claude Code launches it)."""
    build_server().run()


if __name__ == "__main__":
    main()
