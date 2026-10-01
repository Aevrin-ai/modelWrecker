"""The MCP server: wraps the safe service functions as MCP tools.

Built on the MCP Python SDK v2 (`MCPServer`, renamed from v1's `FastMCP`). Only safe orchestration
tools are exposed (no shell/file-write/http). Over local stdio no token is needed; a networked
transport requires MW_MCP_TOKEN (see service.authorize). Build it with build_server() (handy for tests)
and run it with main().
"""

from __future__ import annotations

from .service import McpService


def build_server(runs_dir: str = "runs"):
    """Create the MCP server with modelWrecker's safe tools registered (MCP SDK v2 `MCPServer`)."""
    from mcp.server.mcpserver import MCPServer

    service = McpService(runs_dir=runs_dir)
    mcp = MCPServer("modelwrecker")

    @mcp.tool()
    def list_strategies() -> list[dict]:
        """List the attack strategies modelWrecker can run."""
        return service.list_strategies()

    @mcp.tool()
    def validate_config(config_path: str) -> dict:
        """Validate a modelWrecker config file. Returns {ok, problems}."""
        return service.validate_config(config_path)

    @mcp.tool()
    async def run(config_path: str, run_id: str | None = None) -> dict:
        """Run a config's objectives against its authorized target. Returns a findings summary."""
        return await service.run(config_path, run_id=run_id)

    @mcp.tool()
    def get_findings(run_id: str) -> list[dict]:
        """Get the findings from a finished run."""
        return service.get_findings(run_id)

    @mcp.tool()
    def get_report(run_id: str) -> str:
        """Render a markdown report for a finished run."""
        return service.get_report(run_id)

    @mcp.tool()
    def replay(run_id: str, evidence_id: str) -> dict:
        """Return the reproduction payload and steps for a recorded finding."""
        return service.replay(run_id, evidence_id)

    return mcp


def main() -> None:
    """Run the server over stdio (how an MCP client such as Claude Code launches it)."""
    build_server().run()


if __name__ == "__main__":
    main()
