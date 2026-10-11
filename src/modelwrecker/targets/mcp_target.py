"""MCP-connected agent target.

An agent whose tools come from an MCP server. The MCP-specific attack surface is tool poisoning (a
tool whose description carries hidden instructions, OWASP MCP03) and over-broad scope (OWASP
MCP02/MCP10). We pass tool descriptions to the model verbatim, so a poisoned description can hijack
the agent. Tool calls are only observed, never executed. See docs/targets/OVERVIEW.md.

Tools can be supplied inline via `target_options.tools` (each {name, description, sensitive}); a
live MCP server connection is a documented follow-up (the inline form exercises the attack path).
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
        self._provider = provider
        self._system = system
        self._tools = tools_from_options(options or {})
        self._server = str((options or {}).get("server", "inline"))
        self._max_steps = int((options or {}).get("max_steps", 4))

    def capabilities(self) -> set[Capability]:
        return {
            Capability.SEND_MESSAGE,
            Capability.CALL_TOOL,
            Capability.OBSERVE_TOOL_CALL,
            Capability.TOOL_ENVIRONMENT,
            Capability.RESET_SESSION,
            Capability.GET_METADATA,
        }

    async def get_metadata(self) -> dict:
        return {
            "model": self._provider.model,
            "provider": self._provider.name,
            "mcp_server": self._server,
            "tools": [t["name"] for t in self._tools],
        }

    async def send_message(self, text: str, **opts: object) -> Observation:
        return await run_tool_agent(self._provider, self._system, self._tools, text, **opts)

    def tools(self) -> list[dict]:
        return list(self._tools)

    async def run_scenario(
        self, task: str, environment: dict[str, str], tools: list[dict] | None = None,
        **opts: object,
    ) -> Observation:
        """One simulated tool session. `tools` adds scenario tools to the configured ones."""
        merged = _merge_tools(self._tools, tools or [])
        return await run_tool_session(
            self._provider, self._system, merged, task, environment, self._max_steps, **opts
        )

    async def reset_session(self) -> None:
        return None
