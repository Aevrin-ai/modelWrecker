"""Chat/completions API target: the Phase 4 baseline target.

Wraps a provider and presents the Target interface. It is the system under test, not a provider - the
engine attacks a Target. Responses are returned as data, never executed (see docs/security/SECURITY.md).
"""

from __future__ import annotations

from ..data import Observation, ToolCall
from ..interfaces import Capability
from ..providers.base import BaseProvider
from .base import UnsupportedCapability


class ChatTarget:
    name = "chat"
    version = "1"

    def __init__(self, provider: BaseProvider, system: str | None = None) -> None:
        self._provider = provider
        self._system = system

    def capabilities(self) -> set[Capability]:
        return {
            Capability.SEND_MESSAGE,
            Capability.SEND_MULTITURN,
            Capability.RESET_SESSION,
            Capability.GET_METADATA,
        }

    async def get_metadata(self) -> dict:
        return {"model": self._provider.model, "provider": self._provider.name}

    async def send_message(self, text: str, **opts: object) -> Observation:
        messages: list[dict] = []
        if self._system:
            messages.append({"role": "system", "content": self._system})
        messages.append({"role": "user", "content": text})
        return await self._send(messages, **opts)

    async def send_multiturn(self, thread: list[dict], **opts: object) -> Observation:
        if not all(isinstance(m, dict) and "role" in m for m in thread):
            raise UnsupportedCapability("thread must be a list of {role, content} messages")
        messages = list(thread)
        if self._system and (not messages or messages[0].get("role") != "system"):
            messages = [{"role": "system", "content": self._system}, *messages]
        return await self._send(messages, **opts)

    async def reset_session(self) -> None:
        # Stateless chat target: nothing to reset between attempts.
        return None

    async def _send(self, messages: list[dict], **opts: object) -> Observation:
        completion = await self._provider.generate(messages, **opts)
        return Observation(
            attempt_id="",  # filled in by the caller
            response=completion.text,
            reasoning=completion.reasoning,
            tool_calls=[ToolCall(name=tc.get("function", {}).get("name", "unknown"), args=tc)
                        for tc in completion.tool_calls],
            target_meta={
                "model": completion.model,
                "latency_ms": completion.latency_ms,
                "prompt_tokens": completion.usage.prompt_tokens,
                "completion_tokens": completion.usage.completion_tokens,
            },
        )
