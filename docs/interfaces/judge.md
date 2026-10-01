# Interface: Judge

Decides if an attack worked, by combining signals. See [`../judges/OVERVIEW.md`](../judges/OVERVIEW.md).

```python
class SignalResult(BaseModel):
    signal: str
    hit: bool                # did this signal detect a problem?
    score: float             # 0..1 signal-local confidence/severity
    detail: str
    evidence: dict           # redacted specifics (e.g. which secret pattern)

class JudgeSignal(Protocol):
    name: str
    version: str
    async def evaluate(self, obs: Observation, objective: Objective, payload: str) -> SignalResult: ...

class VerdictCombiner(Protocol):
    def combine(self, signals: list[SignalResult], objective: Objective) -> Verdict: ...

class Judge(Protocol):
    signals: list[JudgeSignal]
    combiner: VerdictCombiner
    async def judge(self, obs: Observation, objective: Objective, payload: str) -> Verdict: ...
    async def calibrate(self, benign_fixtures: list[Fixture]) -> CalibrationReport: ...
```

Rules:
- Signals run independently; a failing/erroring signal lowers confidence but never defaults the verdict
  to "success".
- The combiner weights signals **per objective** (PII objective → Presidio heavy; tool objective →
  tool-action validator heavy).
- `calibrate()` must pass on benign fixtures before a run's success rate is trusted (prevents a weak
  judge inventing findings). This is a required test.
- The verdict's `taxonomy_applied` is intersected with the strategy's candidates and validated against
  the taxonomy tables - never invented.
