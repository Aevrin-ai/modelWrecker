"""Provider base types.

A provider moves bytes to/from a model endpoint. No attack logic (see docs/providers/OVERVIEW.md).
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel, Field


class ProviderError(Exception):
    """A clean, typed provider failure. Network/timeout errors become this, never an unhandled
    crash."""


class Usage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class Completion(BaseModel):
    text: str = ""
    reasoning: str = ""
    tool_calls: list[dict] = Field(default_factory=list)
    usage: Usage = Field(default_factory=Usage)
    latency_ms: int = 0
    http_status: int = 0
    model: str = ""
    raw: dict = Field(default_factory=dict)  # redacted before storage


class ProviderCapabilities(BaseModel):
    streaming: bool = False
    tools: bool = False
    vision: bool = False
    reasoning: bool = False
    max_context: int = 0


class HealthStatus(BaseModel):
    ok: bool
    detail: str = ""
    latency_ms: int = 0


class BaseProvider(ABC):
    """Common base for providers. Concrete adapters implement `generate`."""

    name: str = "base"
    version: str = "0"

    def __init__(self, model: str) -> None:
        self.model = model

    @abstractmethod
    async def generate(self, messages: list[dict], **params: object) -> Completion: ...

    async def count_tokens(self, messages: list[dict]) -> int:
        """Rough token estimate (~4 chars/token). Good enough for budgets; override for
        exactness."""
        chars = sum(len(str(m.get("content", ""))) for m in messages)
        return max(1, chars // 4)

    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities()

    async def health_check(self) -> HealthStatus:
        try:
            c = await self.generate([{"role": "user", "content": "ping"}], max_tokens=1)
            return HealthStatus(ok=True, detail=f"model={c.model or self.model}",
                                latency_ms=c.latency_ms)
        except ProviderError as e:
            return HealthStatus(ok=False, detail=str(e))

    async def aclose(self) -> None:
        """Close any held client. Called once at the run boundary (see
        docs/providers/OVERVIEW.md)."""
        return None
