# Interface: Transform

One payload transformation. Optional, planner-driven. See
[`../attack-engine/PAYLOAD-ENGINE.md`](../attack-engine/PAYLOAD-ENGINE.md).

```python
class Transform(Protocol):
    name: str
    version: str
    params_schema: type[BaseModel]
    reversible: bool

    def apply(self, payload: Payload, **params) -> Payload: ...
    def decode(self, payload: Payload, **params) -> Payload: ...   # if reversible

class PayloadEngine(Protocol):
    def transform(self, payload: Payload, name: str, **params) -> Payload: ...
    def chain(self, payload: Payload, chain: list[ChainStep]) -> Payload: ...
    async def mutate(self, payload: Payload, attacker: Provider, goal: str) -> Payload: ...  # anti-classifier
    def decode(self, payload: Payload, chain: list[ChainStep]) -> Payload: ...
```

Rules:
- Transforms are independent of the attack engine and of each other.
- A transform that would break required structure skips with a note rather than corrupting the payload.
- Every applied transform is recorded in the attempt's `transform_chain` for reproducibility.
- `mutate` is the only transform that may call a model (the attacker LLM), via `ctx`.
