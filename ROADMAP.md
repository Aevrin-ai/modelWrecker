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

- **Phase 4 - minimum engine (done).** OpenAI-compatible provider + factory + lifecycle; chat target with
  an authorization gate; planner + loop; judge + calibration; reliability replay; evidence + finding
  engine; JSONL/SQLite storage; CLI. Verified end to end over HTTP and live against OpenRouter. Harness
  MCP server, Dockerfile, and a built wheel came in alongside it.
- **Phase 5 - strategy system (done).** First-party `best_of_n`, `prefill`, `many_shot`, `crescendo`;
  reports show the full attempt transcript (prompt sent, model reply, result). **PyRIT 1.1 integrated**:
  `pyrit_send`, `pyrit_pair` (PAIR), `pyrit_tap` (TAP) via a provider bridge - PAIR runs offline to a
  SUCCESS outcome.
- **Phase 6 - payload engine (done).** First-party transforms (base64/rot13/reverse/zero_width/leetspeak/
  homoglyph) + chains + reversible round-trips; PyRIT converters wrapped as transforms; `encoded_jailbreak`
  strategy; `transforms` CLI command.
- **Docker (done).** Built and verified: non-root, full in-container attack loop.

## In progress / next

- **Phase 7** - Campaign engine (parallel runs, budgets, limits, stop conditions).
- Loose ends: Ollama local run (free path, not run in this environment), `replay` full re-execution,
  `--output sarif/html`, and a verified PyPI publish.

## Later

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
