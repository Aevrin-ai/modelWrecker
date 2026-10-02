# Testing

Tests are the contract. Nothing is "done" until tests pass. Use the project `.venv` (never global pip):

```bash
uv venv
uv pip install -e ".[dev,mcp,attacks]"
.venv\Scripts\python -m pytest -q    # 225 tests, offline, no API key
.venv\Scripts\python -m ruff check src tests    # lint; must be clean
```

Without the `attacks` extra (PyRIT), the PyRIT tests skip and the rest still pass.

## What must be tested

- **Interfaces** - every adapter (provider/target/strategy/judge/transform) tested against a fake peer,
  including the happy path (a real case where an untested success path crashed on first success).
- **Judge calibration** - each judge configuration must score benign fixtures as refusals; a required
  test (prevents false findings). See [`../judges/OVERVIEW.md`](../judges/OVERVIEW.md).
- **Reliability** - replay logic tested with a stubbed target that complies k-of-N; verify the label.
- **Security** - egress guard blocks loopback/link-local/RFC1918/metadata and re-checks on redirect;
  read confinement rejects `../` and symlink escapes; redaction removes keys/headers/PII before write.
- **State** - atomic writes survive a simulated crash; a torn read never resets to `{}`.
- **Taxonomy** - a mapping to an unknown ID is rejected at write time.
- **Determinism/repro** - `replay` reproduces a finding from evidence.

## Test types

- Unit tests for each module.
- Property-based tests (Hypothesis) for the egress guard, transforms (encode→decode round-trips), and
  state writes - the areas where edge cases bite.
- Integration tests for one full loop against a local stub model.

## Fakes, not live models

Default tests use fake providers/targets so the suite is fast, offline, and free. A separate, opt-in
suite can run against a local Ollama model for smoke tests. No test calls a paid API.

## CI

CI (`.github/workflows/ci.yml`) runs, on every pull request and every push to `main`:

- lint: `ruff check src tests`, with ruff pinned to an exact version in the workflow so a new ruff
  release cannot fail CI with checks nobody ran locally (bump it on purpose, in its own pull request);
- the offline engine suite (`pytest -q`, with the `dev`, `mcp`, and `attacks` extras);
- the control-plane API typecheck and tests;
- the landing page and dashboard builds.

A red check blocks merge. Type-checking the engine (mypy) is not in CI yet.
