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

- **Phase 4 - minimum engine.** Project scaffolding started: packaging, package layout, interfaces as
  Python Protocols, data models, config models, and a CLI skeleton. Concrete adapters and the loop land
  next in this phase.

## Next (finish Phase 4 - minimum engine)

Build the smallest end-to-end slice, each piece behind its interface:

- Provider interface + OpenAI adapter + OpenAI-compatible adapter + any-llm multiplexer (covers
  Ollama/vLLM/OpenRouter).
- One target adapter: a chat/completions API target.
- Attacker loop (run_turn / run_autonomous) + a basic Attack Planner.
- One attack strategy (direct single-shot jailbreak) through the Strategy interface.
- Judge: LLM judge + secret/PII detector, with calibration tests.
- Reliability replay.
- Evidence store + Finding engine.
- CLI: `run`, `report`, `validate`.

Exit criterion: `modelwrecker run target.yaml` finds, verifies, and reports one finding locally
against a model served by Ollama, with no paid service involved.

## Later

- **Phase 5** - Full strategy system (PAIR, TAP, Crescendo, best-of-N, many-shot, prefill, ...),
  reusing PyRIT (with its memory/scoring) behind adapters.
- **Phase 6** - Payload engine (transform/chain/mutate), planner-driven, optional.
- **Phase 7** - Campaign engine (parallel runs, budgets, limits, stop conditions).
- **Phase 8** - Reliability & analytics (confidence scoring, dashboards of ASR, leaderboards),
  garak batch-scan adapter.
- **Phase 9** - Agent, RAG, then MCP targets and the matching strategies/judges;
  **harness integration** (MCP server + JSON driver so Claude Code / Codex can drive modelWrecker;
  see `docs/features/harness-integration.md`).
- **Phase 10** - Production security hardening; optional authenticated API layer.

## Known problems / risks

- OWASP ASI (agentic) exact entry titles must be pulled from the official 2026 PDF at
  implementation time before any mapping is shipped. See `docs/research/taxonomies.md`.
- Provider SDK churn and the LiteLLM supply-chain incident (Mar 2026) mean the provider layer
  must stay thin and swappable. See `docs/decisions/ADR-0003-provider-abstraction.md`.
- Reusing PyRIT/garak deeply risks coupling our core to their internals; keep them behind
  adapters. See `docs/decisions/ADR-0006-reuse-pyrit-garak.md`.
