"""MCP-connected agent target.

An agent whose tools come from an MCP server. The MCP-specific attack surface is tool poisoning (a
tool whose description carries hidden instructions, OWASP MCP03) and over-broad scope (OWASP
MCP02/MCP10). We pass tool descriptions to the model verbatim, so a poisoned description can hijack
the agent. Tool calls are only observed, never executed. See docs/targets/OVERVIEW.md.

Tools can be supplied inline via `target_options.tools` (each {name, description, sensitive}), or
discovered from a live MCP server via `target_options.mcp_url` (streamable HTTP). Discovery reads
the server's tool list and descriptions; it never calls a tool, so connecting cannot change it.
"""

from __future__ import annotations

from ..data import Observation
from ..interfaces import Capability
from ..providers.base import BaseProvider
from .agent import _merge_tools, run_tool_agent, run_tool_session, tools_from_options


class McpTarget:
    name = "mcp"
    version = "1"

    def __init__(
        self, provider: BaseProvider, system: str | None = None, options: dict | None = None
    ) -> None:
        options = options or {}
        self._provider = provider
        self._system = system
        self._inline_tools = tools_from_options(options)
        self._mcp_url = str(options.get("mcp_url") or "") or None
        self._sensitive = {str(s) for s in (options.get("sensitive_tools") or [])}
        self._server = str(options.get("server") or (self._mcp_url if self._mcp_url else "inline"))
        self._max_steps = int(options.get("max_steps", 4))
        self._discovered: list[dict] | None = None

    def capabilities(self) -> set[Capability]:
        return {
            Capability.SEND_MESSAGE,
            Capability.CALL_TOOL,
            Capability.OBSERVE_TOOL_CALL,
            Capability.TOOL_ENVIRONMENT,
            Capability.RESET_SESSION,
            Capability.GET_METADATA,
        }

    async def _catalog(self) -> list[dict]:
        """Inline tools plus any discovered from the live MCP server (discovered once, cached)."""
        if self._mcp_url and self._discovered is None:
            from .mcp_client import discover_tools

            self._discovered = await discover_tools(self._mcp_url, sensitive=self._sensitive)
        return _merge_tools(self._inline_tools, self._discovered or [])

    async def get_metadata(self) -> dict:
        tools = await self._catalog()
        return {
            "model": self._provider.model,
            "provider": self._provider.name,
            "mcp_server": self._server,
            "live_mcp": bool(self._mcp_url),
            "tools": [t["name"] for t in tools],
        }

    async def send_message(self, text: str, **opts: object) -> Observation:
        return await run_tool_agent(
            self._provider, self._system, await self._catalog(), text, **opts
        )

    def tools(self) -> list[dict]:
        return list(self._inline_tools)

    async def run_scenario(
        self, task: str, environment: dict[str, str], tools: list[dict] | None = None,
        **opts: object,
    ) -> Observation:
        """One simulated tool session. `tools` adds scenario tools to the discovered/inline ones."""
        merged = _merge_tools(await self._catalog(), tools or [])
        return await run_tool_session(
            self._provider, self._system, merged, task, environment, self._max_steps, **opts
        )

    async def reset_session(self) -> None:
        return None
