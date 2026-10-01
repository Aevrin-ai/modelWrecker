# Interface: Target

The system under test. Exposes only the capabilities it truly supports. See
[`../targets/OVERVIEW.md`](../targets/OVERVIEW.md).

```python
class Capability(str, Enum):
    SEND_MESSAGE = "send_message"
    SEND_MULTITURN = "send_multiturn"
    UPLOAD_IMAGE = "upload_image"
    CALL_TOOL = "call_tool"
    OBSERVE_TOOL_CALL = "observe_tool_call"
    RESET_SESSION = "reset_session"
    GET_METADATA = "get_metadata"

class Target(Protocol):
    name: str
    version: str

    def capabilities(self) -> set[Capability]: ...
    async def get_metadata(self) -> TargetMetadata: ...          # model/version/config for evidence
    async def send_message(self, text: str, **opts) -> Observation: ...
    async def send_multiturn(self, thread: list[Message], **opts) -> Observation: ...
    async def upload_image(self, image: bytes, prompt: str, **opts) -> Observation: ...
    async def call_tool(self, name: str, args: dict) -> Observation: ...
    async def observe_tool_call(self, observation: Observation) -> list[ToolCall]: ...
    async def reset_session(self) -> None: ...
```

Rules:
- A target implements only the methods matching its declared `capabilities()`. Calling an
  unsupported one raises `UnsupportedCapability` **before** any network call; the planner checks
  capabilities first, so strategies never hit this at runtime.
- All responses are **untrusted**: returned as data in an `Observation`, never executed or followed.
- Any outbound HTTP a target makes on our behalf goes through the egress guard
  ([`../security/SECURITY.md`](../security/SECURITY.md)).
- Model targets use a `Provider` internally; agent/RAG/MCP/HTTP targets wrap their own transport
  (MCP client, httpx) but present the same interface.
