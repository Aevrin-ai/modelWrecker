# Decisions log

This is the short index of important decisions. The full reasoning for each one lives as an
ADR (Architecture Decision Record) in `docs/decisions/`. When a decision changes, add a **new**
entry explaining why - never rewrite history.

Format of each ADR: Decision · Why · Alternatives · Trade-offs · Date · Status.

| # | Decision | Status | ADR |
|---|----------|--------|-----|
| 0001 | Python 3.12+ as the implementation language | Accepted | [ADR-0001](docs/decisions/ADR-0001-language-and-stack.md) |
| 0002 | License modelWrecker under Apache-2.0; do **not** reuse AGPL-licensed red-team code | Accepted | [ADR-0002](docs/decisions/ADR-0002-license.md) |
| 0003 | Thin internal Provider interface; direct SDK adapters + **any-llm as the default multiplexer**; no hard dependency on any gateway service | Accepted | [ADR-0003](docs/decisions/ADR-0003-provider-abstraction.md) |
| 0004 | Separate attacker / target / judge as distinct roles and code | Accepted | [ADR-0004](docs/decisions/ADR-0004-attacker-target-judge-split.md) |
| 0005 | Strategy plugin system; adaptive attack loop is core IP | Accepted | [ADR-0005](docs/decisions/ADR-0005-strategy-plugin-system.md) |
| 0006 | Reuse PyRIT (MIT) + garak (Apache-2.0) behind adapters; **thin adapter + reuse PyRIT memory/scoring** | Accepted | [ADR-0006](docs/decisions/ADR-0006-reuse-pyrit-garak.md) |
| 0007 | Multi-signal judge ensemble (LLM + rules + Presidio PII + secret detector + tool-action) | Accepted | [ADR-0007](docs/decisions/ADR-0007-multi-signal-judge.md) |
| 0008 | Security model: auth-by-default, host-tool gating, egress guard, sandboxing | Accepted | [ADR-0008](docs/decisions/ADR-0008-security-model.md) |
| 0009 | First-party payload/transform engine; do not vendor plinius corpora | Accepted | [ADR-0009](docs/decisions/ADR-0009-first-party-payload-engine.md) |
| 0010 | No mandatory checksum / corpus-integrity gate in the attack path | Accepted | [ADR-0010](docs/decisions/ADR-0010-no-mandatory-checksum-gate.md) |
| 0011 | Evidence/finding store: local append-only JSONL + SQLite index, atomic writes | Accepted | [ADR-0011](docs/decisions/ADR-0011-storage.md) |
| 0012 | Engine is a library + CLI first; any API/UI is a separate, authenticated layer | Accepted | [ADR-0012](docs/decisions/ADR-0012-engine-library-first.md) |
| 0013 | Harness integration: an MCP server + driver so Claude Code / Codex / other agentic harnesses can run modelWrecker against a model and get the results back | Accepted | [ADR-0013](docs/decisions/ADR-0013-harness-integration.md) |

## Resolved maintainer decisions

Confirmed by the maintainer on 2026-10-01:

- **Default multi-provider adapter:** adopt **any-llm** as the default multiplexer behind the Provider
  interface; direct SDK + OpenAI-compatible adapters remain first-class fallbacks. (ADR-0003)
- **PyRIT depth:** **thin adapter + reuse PyRIT memory and scoring** (hybrid). (ADR-0006)
- **Target order:** chat API first, then **agent, RAG, and MCP** targets. (ROADMAP, `docs/targets/OVERVIEW.md`)
- **Harness integration** is in scope as a first-class feature. (ADR-0013, `docs/features/harness-integration.md`)

No open decisions remain.
