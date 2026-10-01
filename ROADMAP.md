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
- **Phase 7 - campaign engine (done).** `campaigns/engine.py`: parallel objectives (per-run semaphore),
  budgets (attempts/tokens/wall-clock/objective count), stop conditions (`complete`/`first_finding`/
  `budget`), bounded retries on transient errors, and per-objective error isolation. Exposed via the
  `campaign:` config section and `run` flags (`--concurrency`, `--stop-on`, `--max-objectives`,
  `--max-seconds`). Verified offline and through the real CLI against a loopback stub.
- **Phase 8 - reliability & analytics (done).** `analytics/`: ASR measured at the attempt level with
  **Wilson 95% confidence intervals** (reused from `reliability/replay.py`), breakdowns by strategy and
  objective category, findings by severity and taxonomy, and a cross-run **model leaderboard** (most-robust
  first). Output is **static artifacts only** - a self-contained HTML report plus JSON and CSV, via
  `modelwrecker analyze` (no server; that is Phase 10). Reliability now also records the CI and a
  high-variance flag. **garak adapter** (`garak_probe`, ADR-0006): loads a probe's prompts and sends them at
  our target, judged by our judge; registers with the `scan` extra. Verified offline and through the real
  CLI over two stub runs. The garak adapter is also verified live with the `scan` extra: real probes load
  and a full `garak_probe` attack loop runs against a loopback stub (no API key).
- **Phase 9 - new target types (done).** `config.target.type` + a target factory select chat (default),
  **agent** (`targets/agent.py`, tool-using - tool calls observed, never executed), **rag**
  (`targets/rag.py`, retrieval + indirect injection via ingested documents), or **mcp**
  (`targets/mcp_target.py`, tool poisoning via poisoned tool descriptions). Matching strategies
  `tool_misuse` (OWASP LLM03/ASI01), `rag_injection` (LLM01/LLM05), `mcp_tool_poisoning` (MCP03), each
  gated by the capability only its target declares. New `tool_misuse` judge signal (decisive for agent/MCP).
  Tested offline; the agent path is also verified through the real CLI (critical finding, LLM03/ASI01). A
  live MCP-server connection (inline tools work today) is a documented follow-up.

## In progress / next

- Loose ends (tackled after the phases below are each built and tested): Ollama local run (free
  self-hostable path), `replay` full re-execution, `--output sarif/html`, and money/cost budgets
  (needs per-model pricing).

## Later

- **Phase 10 - Production hardening + authenticated surfaces.** This is where every network surface
  and the hosted product live. One engine, many front doors, one shared auth layer:
  - **Security hardening**: sandbox for attack-generated code (timeouts, memory/cpu limits, no host
    reach), egress-guard audit under redirects/DNS-rebinding, redaction audit, threat-model pass
    over the Phase 9 agent/RAG/MCP surface.
  - **REST API backend** (in this repo): auth-by-default (OAuth 2.1 / bearer), anti-CSRF, refuses
    non-loopback binds without auth. This is the one backend the UI, the CLI, and remote agents call.
  - **Data layer**: a managed Postgres database with row-level security (RLS) enabled, so every row is
    scoped to its owner/tenant and the auth identity decides what is visible. Table migrations are applied
    there as part of this phase. Credentials are supplied out of band (local untracked files + the deploy
    secret store), never in the repo. The project/database to use is recorded in the local project memory.
  - **Auth provider**: Google sign-in (OAuth) issues the user identity that the API, the UI, and the CLI
    all trust. Google Cloud Console setup (OAuth client, authorized redirect URIs, consent screen) is a
    manual step the maintainer does; the build will call out exactly what values are needed when that
    wiring starts.
  - **Authenticated remote MCP for agents**: run the MCP server over Streamable HTTP with OAuth 2.1
    bearer auth so Claude Code / Codex can use a hosted modelWrecker with authentication (local
    stdio MCP stays available and needs no network auth). Shares the REST API's auth/token layer.
  - **CLI authentication + distribution**: publish `modelwrecker` to PyPI so `pip install
    modelwrecker` works; add `modelwrecker login` (OAuth 2.0 device-code flow against
    app.aevrin.net, with an API-key fallback for CI) storing a `0600` token; `run --remote` then
    calls the authenticated API.
  - **Web UI + hosting (separate frontend surface, not this repo)**: a React + TypeScript + shadcn app
    and a hero/landing page on app.aevrin.net, hosted on Cloudflare, that talk to the REST API (browsers
    use REST, not MCP). The maintainer will provide the landing-page and dashboard design prompts when
    this starts. shadcn MCP and chrome-devtools MCP are dev-time build helpers, not product code.

## Known problems / risks

- OWASP ASI (agentic) exact entry titles must be pulled from the official 2026 PDF at
  implementation time before any mapping is shipped. See `docs/research/taxonomies.md`.
- Provider SDK churn and the LiteLLM supply-chain incident (Mar 2026) mean the provider layer
  must stay thin and swappable. See `docs/decisions/ADR-0003-provider-abstraction.md`.
- Reusing PyRIT/garak deeply risks coupling our core to their internals; keep them behind
  adapters. See `docs/decisions/ADR-0006-reuse-pyrit-garak.md`.
