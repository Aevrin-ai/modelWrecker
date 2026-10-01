# Interface: Provider

Moves bytes to/from a model endpoint. No attack logic. See
[`../providers/OVERVIEW.md`](../providers/OVERVIEW.md).

```python
class ProviderCapabilities(BaseModel):
    streaming: bool
    tools: bool            # supports tool/function calling
    vision: bool           # accepts images
    reasoning: bool        # exposes a thinking/reasoning channel
    max_context: int
    native_prefill: bool   # supports assistant-prefill

class Completion(BaseModel):
    text: str
    reasoning: str | None
    tool_calls: list[ToolCall]
    usage: Usage           # prompt/completion tokens
    http_status: int
    model: str
    raw: dict              # redacted

class Provider(Protocol):
    name: str
    version: str

    async def generate(self, messages: list[Message], **params) -> Completion: ...
    async def stream(self, messages: list[Message], **params) -> AsyncIterator[StreamEvent]: ...
    async def count_tokens(self, messages: list[Message]) -> int: ...
    def capabilities(self) -> ProviderCapabilities: ...
    async def health_check(self) -> HealthStatus: ...
    async def aclose(self) -> None: ...        # close the HTTP client; called once at the run boundary
```

Rules:
- Network/timeout errors raise `ProviderError`, a clean typed failure - never an unhandled crash.
- The provider never reads/writes config or secrets; it is given a resolved `Endpoint`.
- `aclose()` is called by the engine's run context, not by strategies (fixes a common client-leak failure mode).
- Only `generate`/`stream`/`count_tokens`/`capabilities`/`health_check` are required at first; more is added only when a feature needs it.
