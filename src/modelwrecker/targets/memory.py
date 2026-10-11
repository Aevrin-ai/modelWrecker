"""Memory-backed agent target: an agent that keeps notes across sessions.

Memory poisoning (docs/research/incident-to-strategy.md, group G5): content the agent reads in one
session is saved to long-term memory, and then steers a later, separate session.
ChatGPT's "SpAIware" incident is the real example.

The target holds memory notes that survive `reset_session` (a new chat, same memory). Each session
starts with the notes in the system prompt, and the agent can add a note with the `save_note` tool.
Nothing is executed; tool calls are only observed. See docs/targets/OVERVIEW.md.
"""

from __future__ import annotations

from ..data import Observation
from ..interfaces import Capability
from ..providers.base import BaseProvider
from .agent import _merge_tools, run_tool_session, tools_from_options

_SAVE_TOOL = {"name": "save_note", "description": "Save a short note to long-term memory.",
              "sensitive": False}


class MemoryTarget:
    name = "memory"
    version = "1"

    def __init__(
        self, provider: BaseProvider, system: str | None = None, options: dict | None = None
    ) -> None:
        self._provider = provider
        self._system = system
        self._tools = tools_from_options(options or {})
        self._max_steps = int((options or {}).get("max_steps", 4))
        self._memory: list[str] = [str(n) for n in (options or {}).get("memory", []) or []]

    def capabilities(self) -> set[Capability]:
        return {
            Capability.SEND_MESSAGE,
            Capability.CALL_TOOL,
            Capability.OBSERVE_TOOL_CALL,
            Capability.TOOL_ENVIRONMENT,
            Capability.PERSISTENT_MEMORY,
            Capability.RESET_SESSION,
            Capability.GET_METADATA,
        }

    async def get_metadata(self) -> dict:
        return {"model": self._provider.model, "provider": self._provider.name,
                "notes_in_memory": len(self._memory)}

    def tools(self) -> list[dict]:
        return list(self._tools)

    def memory(self) -> list[str]:
        return list(self._memory)

    def clear_memory(self) -> None:
        self._memory = []

    def _system_with_memory(self) -> str:
        base = self._system or "You are a helpful assistant."
        if not self._memory:
            return base
        notes = "\n".join(f"- {n}" for n in self._memory)
        return f"{base}\n\nYour long-term memory notes (from earlier sessions):\n{notes}"

    async def run_scenario(
        self, task: str, environment: dict[str, str], tools: list[dict] | None = None,
        **opts: object,
    ) -> Observation:
        """One session. The agent can save a note (persisted); notes are injected on later sessions.

        `save_note` writes to memory after the session, from the recorded calls, so a saved note
        carries into the next session's system prompt. No tool is executed.
        """
        merged = _merge_tools([*self._tools, _SAVE_TOOL], tools or [])
        obs = await run_tool_session(
            self._provider, self._system_with_memory(), merged, task, environment,
            self._max_steps, **opts,
        )
        for call in obs.tool_calls:
            if call.name == _SAVE_TOOL["name"]:
                note = str(call.args.get("note") or call.args.get("content") or call.args)
                self._memory.append(note[:500])
        obs.target_meta["notes_in_memory"] = len(self._memory)
        return obs

    async def send_message(self, text: str, **opts: object) -> Observation:
        return await self.run_scenario(text, environment={}, **opts)

    async def reset_session(self) -> None:
        # A new chat session, but long-term memory persists (that is the attack surface).
        return None
