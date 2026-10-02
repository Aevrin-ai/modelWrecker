"""A fake provider for offline tests.

Lets the whole engine run without any network or API key, so unit/integration/e2e tests are fast,
free, and deterministic (see docs/workflows/TESTING.md). A test supplies a `responder` that maps the
messages to a reply string.
"""

from __future__ import annotations

from collections.abc import Callable

from .base import BaseProvider, Completion, ProviderCapabilities, Usage

Responder = Callable[[list[dict]], str]


class FakeProvider(BaseProvider):
    name = "fake"
    version = "1"

    def __init__(self, model: str = "fake-model", responder: Responder | None = None) -> None:
        super().__init__(model)
        self._responder = responder or (lambda _messages: "I cannot help with that.")
        self.calls: list[list[dict]] = []

    async def generate(self, messages: list[dict], **params: object) -> Completion:
        self.calls.append(messages)
        text = self._responder(messages)
        return Completion(
            text=text,
            usage=Usage(prompt_tokens=10, completion_tokens=len(text) // 4, total_tokens=0),
            latency_ms=1,
            http_status=200,
            model=self.model,
        )

    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(streaming=False, tools=False)
