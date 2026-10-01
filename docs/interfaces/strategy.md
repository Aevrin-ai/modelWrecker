# Interface: Strategy

One attack algorithm. See [`../attack-engine/STRATEGIES.md`](../attack-engine/STRATEGIES.md).

```python
class StrategyContext(BaseModel):
    objective: Objective
    target: Target               # capability-checked by the planner already
    judge: Judge                 # for strategies that need in-loop grading (e.g. PAIR)
    attacker: Provider | None    # for strategies that reason with an attacker LLM
    payloads: PayloadEngine
    budget: BudgetSlice          # tokens/time/attempts this strategy may use
    emit: Callable[[str], None]  # progress line
    deadline: float              # wall-clock

class StrategyResult(BaseModel):
    best: Attempt | None
    attempts: list[Attempt]      # all attempts made (each with its Observation + Verdict)
    outcome: Outcome             # success / partial / refused / error
    note: str

class Strategy(Protocol):
    name: str
    version: str
    params_schema: type[BaseModel]
    required_target_capabilities: set[Capability]
    candidate_taxonomy: list[TaxonomyRef]        # verified entries only

    async def run(self, ctx: StrategyContext) -> StrategyResult: ...
```

Rules:
- A strategy **never** imports a provider/target adapter directly; it uses what `ctx` gives it.
- It must honor `budget` and `deadline` and return cleanly when they are hit.
- It declares the target capabilities it needs (planner skips incompatible targets) and the taxonomy
  entries its attack type can produce (findings draw only from these; see
  [`../architecture/TAXONOMY.md`](../architecture/TAXONOMY.md)).
- A reused OSS algorithm (PyRIT/garak) is wrapped so its output becomes our `Attempt`/`Observation`/
  `Verdict` shapes - the rest of the pipeline can't tell the difference.
- Versioned: a finding records the exact strategy version used.
