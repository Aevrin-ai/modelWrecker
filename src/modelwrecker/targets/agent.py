"""Tool-using agent target.

The system under test is an agent that can call tools. We attack it to make it call a tool it should
not (excessive agency / goal hijack). Tool calls are only *observed and recorded* - modelWrecker
never executes a tool the agent asks for, so an attack can never cause a real side effect.
See docs/targets/OVERVIEW.md and docs/security/SECURITY.md.
"""

from __future__ import annotations

from ..data import Observation
from ..interfaces import Capability
from ..providers.base import BaseProvider
from .tool_catalog import merge_tools, tools_from_options
from .tool_session import run_tool_agent, run_tool_session

# re-exported: the other tool-using targets and tests import these from here
__all__ = ["AgentTarget", "run_tool_agent", "run_tool_session", "tools_from_options"]


class AgentTarget:
    name = "agent"
    version = "1"

    def __init__(self, provider: BaseProvider, system: str | None = None,
                 options: dict | None = None) -> None:
        self._provider = provider
        self._system = system
        self._tools = tools_from_options(options or {})
        self._max_steps = int((options or {}).get("max_steps", 4))

    def capabilities(self) -> set[Capability]:
        return {
            Capability.SEND_MESSAGE,
            Capability.SEND_MULTITURN,
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
            "tools": [t["name"] for t in self._tools],
        }

    def tools(self) -> list[dict]:
        return list(self._tools)

    async def run_scenario(self, task: str, environment: dict[str, str],
                           tools: list[dict] | None = None, **opts: object) -> Observation:
        """One simulated tool session. `tools` adds scenario tools to the configured ones."""
        merged = merge_tools(self._tools, tools or [])
        return await run_tool_session(
            self._provider, self._system, merged, task, environment, self._max_steps, **opts
        )

    async def send_message(self, text: str, **opts: object) -> Observation:
        return await run_tool_agent(self._provider, self._system, self._tools, text, **opts)

    async def send_multiturn(self, thread: list[dict], **opts: object) -> Observation:
        last_user = next((m["content"] for m in reversed(thread) if m.get("role") == "user"), "")
        return await self.send_message(last_user, **opts)

    async def reset_session(self) -> None:
        return None
