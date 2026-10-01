# Observability

**Purpose.** Make a run understandable while it happens and reproducible afterward, without leaking
secrets.

## What we emit

- **Structured logs** (JSON) with levels; secrets/PII/auth headers redacted before emission.
- **A per-run event stream** (append-only JSONL): every attempt, observation, verdict, replay, and
  finding, with timestamps. This is also the evidence source. See
  [`../architecture/EVIDENCE-AND-FINDINGS.md`](../architecture/EVIDENCE-AND-FINDINGS.md).
- **Progress lines** from strategies (`ctx.emit`) for interactive runs.
- **Metrics**: attack success rate (ASR) per strategy/objective/target-family, tokens, cost, latency,
  replay rate. Queried from the SQLite index.
- **Optional OpenTelemetry traces** (the MCP SDK and many libs emit OTel by default); off unless
  configured.

## Inference tracing

Each model call records request/response metadata (model, params, usage, status, latency) linked by an
inference id, so a run can be audited and costed. Request/response bodies are redacted.

## Why it matters

ASR-by-strategy drives the planner's bandit and the operator's trust; reproducible event streams are
what make a finding "validated, not just reported" (Aevrin). Logs that leak keys are a finding in
themselves (an Aevrin logging-safety principle) - hence redaction-before-emit everywhere.
