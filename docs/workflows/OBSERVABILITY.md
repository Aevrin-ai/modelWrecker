# Observability

**Purpose.** Make a run understandable while it happens and reproducible afterward, without leaking
secrets.

## What exists today

- **A per-run event stream** (`runs/<run-id>/events.jsonl`, append-only JSONL): one line per attack plan,
  attempt, calibration, reliability replay, and finding, plus run metadata, each with a timestamp.
  Every record is redacted before it is written. This is also the evidence source. See
  [`../architecture/EVIDENCE-AND-FINDINGS.md`](../architecture/EVIDENCE-AND-FINDINGS.md).
- **A SQLite index** (`index.sqlite`) of the run's findings, for quick lookup.
- **Progress lines** from strategies (`ctx.emit`) printed during interactive runs.
- **Per-call metadata** on each observation: model, prompt and completion tokens, and latency in
  milliseconds. Request and response bodies are redacted before they are stored.
- **Analytics** (`modelwrecker analyze`): attack success rate (ASR) per strategy and objective category,
  with Wilson confidence intervals, findings by severity and taxonomy, and a cross-run leaderboard,
  computed from the run artifacts. See [`../attack-engine/ANALYTICS.md`](../attack-engine/ANALYTICS.md).
- **Redacted refusal logs** from the MCP server guardrails (Python `logging`, logger
  `modelwrecker.mcp`). See [`../security/mcp.md`](../security/mcp.md).
- **Structured logs from the control-plane API** (`src/api/src/log.ts`): one JSON line per event, with a
  level, an event name such as `request_failed` or `payment_provider_failed`, and the request id.
  Tokens, keys, and email addresses are redacted before a line is written, and field values are flat on
  purpose, so a whole request body can never be logged. Cloudflare Workers Logs keeps them, so a
  request id a person quotes later still finds its lines. See
  [`../architecture/control-plane-api.md`](../architecture/control-plane-api.md#errors-timeouts-and-retries).
- **Health checks for the API**: `/api/v1/health` (the Worker runs) and `/api/v1/health/ready` (the
  database answers too). What to do when either fails is in [`INCIDENT-RUNBOOK.md`](INCIDENT-RUNBOOK.md).

## Planned, not built

- Structured JSON logs with levels across the whole engine (the control-plane API has them already).
- An inference id that links each model call across the event stream.
- Cost per run, which needs per-model pricing (#25).
- Optional OpenTelemetry traces, off unless configured.
- A planner that uses ASR by strategy to choose its next strategy (a bandit). Today the planner uses a
  fixed order per objective category and does not learn from past ASR. See
  [`../attack-engine/ATTACK-PLANNER.md`](../attack-engine/ATTACK-PLANNER.md).

## Why it matters

Reproducible event streams are what make a finding "validated, not just reported" (Aevrin), and ASR by
strategy is what earns the operator's trust. Logs that leak keys are a finding in themselves (an Aevrin
logging-safety principle) - hence redaction before every write.
