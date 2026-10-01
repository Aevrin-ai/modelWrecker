# Roadmap

What are we building, what is finished, what comes next. This file tracks *status*. For *how*
things work, read `docs/`.

## Done

- **Phase 0 - Research.** Studied Aevrin (product + MCP security model), prior OSS red-team harnesses
  and their security audits, the current OSS red-teaming landscape (PyRIT, garak, promptfoo, DeepTeam)
  and provider gateways (LiteLLM, Portkey, any-llm). Notes in `docs/research/`.
- **Phase 1 - Architecture.** System overview, provider system, attacker engine, target adapters,
  judge engine documented under `docs/architecture/` and the area folders.
- **Phase 2 - Threat model & security design.** `docs/security/THREAT-MODEL.md`,
  `docs/security/SECURITY.md`.
- **Phase 3 - Data model & interfaces.** `docs/architecture/DATA-MODEL.md`, `docs/interfaces/`,
  `docs/architecture/PLUGIN-SYSTEM.md`.
- **Decisions locked (2026-10-01).** any-llm is the default provider multiplexer; PyRIT reuse is a thin
  adapter plus its memory and scoring; target order after chat is agent, RAG, then MCP; harness
  integration is in scope. See `DECISIONS.md`. No open decisions remain.

## In progress

- **Phase 4 - minimum engine.** The core is implemented and verified offline (see
  `docs/testing/test-matrix.md`): OpenAI-compatible provider + factory + lifecycle; chat target with an
  authorization gate; planner + loop; two strategies; multi-signal judge + calibration; reliability
  replay; evidence + finding engine; JSONL/SQLite storage; and the CLI (`init`, `validate`, `check`,
  `provider test`, `run`, `report`, `replay`, `strategies`). A real end-to-end run over HTTP (loopback
  stub) produces a verified finding. 30 offline tests pass.

Also done this phase (ahead of the original plan): the **harness-integration MCP server** (Phase 9 item,
pulled forward) with guardrails and a real client round-trip; a **Dockerfile**; and a built **wheel** that
installs in a fresh venv and runs a full loop. Live OpenRouter run verified.

### Remaining in Phase 4

- **Docker build/run** - BLOCKED here (daemon not running); Dockerfile ready, needs a machine with Docker.
- **Ollama local run** - the free end-to-end path; not run in this environment.
- `replay` full re-execution wiring; `--output sarif/html`.

Exit criterion: largely met over a real provider (OpenRouter) and the wheel/stub full loop. Still open:
the same run against a real local Ollama model, and a verified Docker build.

## Later

- **Phase 5** - Full strategy system (PAIR, TAP, Crescendo, best-of-N, many-shot, prefill, ...),
  reusing PyRIT (with its memory/scoring) behind adapters.
- **Phase 6** - Payload engine (transform/chain/mutate), planner-driven, optional.
- **Phase 7** - Campaign engine (parallel runs, budgets, limits, stop conditions).
- **Phase 8** - Reliability & analytics (confidence scoring, dashboards of ASR, leaderboards),
  garak batch-scan adapter.
- **Phase 9** - Agent, RAG, then MCP *targets* and the matching strategies/judges.
  (**Harness integration** - the MCP server + JSON driver so Claude Code / Codex can drive modelWrecker -
  is already done, pulled forward into Phase 4; see `docs/features/harness-integration.md`.)
- **Phase 10** - Production security hardening; optional authenticated API layer.

## Known problems / risks

- OWASP ASI (agentic) exact entry titles must be pulled from the official 2026 PDF at
  implementation time before any mapping is shipped. See `docs/research/taxonomies.md`.
- Provider SDK churn and the LiteLLM supply-chain incident (Mar 2026) mean the provider layer
  must stay thin and swappable. See `docs/decisions/ADR-0003-provider-abstraction.md`.
- Reusing PyRIT/garak deeply risks coupling our core to their internals; keep them behind
  adapters. See `docs/decisions/ADR-0006-reuse-pyrit-garak.md`.
