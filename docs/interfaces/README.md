# Interfaces (contracts)

These are the contracts between the core engine and everything that plugs into it. **Documentation only
- no implementation yet.** When code is written, these become the Python Protocols/ABCs in
`src/modelwrecker/`, and any change here must update the matching code and
[`../DOCUMENTATION.md`](../DOCUMENTATION.md).

The signatures are shown in Python-like pseudocode for clarity. Real types are Pydantic models from
[`../architecture/DATA-MODEL.md`](../architecture/DATA-MODEL.md).

| Interface | What implements it | Doc |
|-----------|--------------------|-----|
| `Provider` | model-endpoint adapters | [provider.md](provider.md) |
| `Target` | systems under test | [target.md](target.md) |
| `Strategy` | attack algorithms | [strategy.md](strategy.md) |
| `JudgeSignal` + `VerdictCombiner` | judge signals and the combiner | [judge.md](judge.md) |
| `Transform` | payload transforms | [transform.md](transform.md) |

Shared design rules:
- Everything is **async** (the engine is I/O-bound and runs things concurrently).
- Plugins receive their collaborators (provider, target, judge) **via a context object**, never by
  importing an adapter directly (keeps the core decoupled and fixes a common client-lifecycle
  problem).
- Every plugin declares `name`, `version`, and a Pydantic `params_schema`.
- Capabilities and taxonomy candidates are **declared**, so the engine can check compatibility before
  running and never invents a mapping.
