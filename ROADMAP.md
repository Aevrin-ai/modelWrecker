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

## In progress: Phase 10 - local-first product (mostly live)

**Heavy red-team computation always runs on the user's machine** (the local engine, in Docker or from
PyPI), and the Aevrin cloud is a thin **control plane** only - identity, projects, devices,
entitlements, billing, and the dashboard that shows synced metadata. The cloud never runs attacks,
never runs LLM inference, and never becomes a hidden compute dependency. One engine, many front doors
(CLI, Docker, MCP, a future REST API), one shared auth layer. Full boundary:
[`docs/architecture/local-cloud.md`](docs/architecture/local-cloud.md).

```text
Aevrin Cloud  = identity + control + billing + analytics + policy
User's Docker = computation + red teaming + attack engine + MCP + evidence
```

Data layer (ADR-0015): Supabase Postgres + RLS (row-level security, so each query only sees the
caller's rows), Cloudflare Pages for static hosting, a Cloudflare Worker for the API. Billing is
Razorpay, kept entirely in the cloud (no Razorpay secret ever ships in Docker, MCP, CLI, or the engine).
Live cloud setup is staged in [`deploy/`](deploy/README.md) and run by the maintainer; nothing
irreversible is done automatically.

**Live today at https://app.aevrin.net:** landing page, dashboard (`/dashboard/`), staff admin console
(`/admin`), the control-plane API Worker on `app.aevrin.net/api/*`, and Supabase with RLS applied.
Pages project `modelwrecker-app` (the older `aevrin-app` site is kept for rollback). CI redeploys the
sites and the Worker on push, and publishes to PyPI on a `v*` tag; both have run. `modelwrecker` 0.0.2
is on PyPI. The maintainer signed in with Google, approved a device with `modelwrecker login`, and
synced real OpenRouter runs with evidence and transcripts (#7, #28).

**Merged on `main`, not released yet:** the engine entitlement gate in `run` and the
`modelwrecker plan` command (they ship in the next PyPI release).

### Sub-phase status

Each line links to the doc that owns the topic. Test evidence lives in
[`docs/testing/test-matrix.md`](docs/testing/test-matrix.md).

- **10.1 Architecture and docs** - done. [`local-cloud.md`](docs/architecture/local-cloud.md), ADR-0014 to ADR-0020.
- **10.2 Docker product** - done; native Linux/macOS hosts and a live provider run in the container not tested. [`deployment/docker.md`](docs/deployment/docker.md), [`security/docker.md`](docs/security/docker.md).
- **10.3 Security hardening** - egress guard on every model request done; DNS-rebinding pinning (#16), code sandbox (#17), redaction audit (#18) open. [`SECURITY.md`](docs/security/SECURITY.md).
- **10.4 CLI auth and distribution** - device login, `logout`, `sync`, PyPI publish done; API-key login for CI open (#15). [`CLI.md`](docs/reference/CLI.md), [`authentication.md`](docs/security/authentication.md).
- **10.5 MCP guardrails** - local stdio guardrails done; remote MCP over HTTP with OAuth 2.1 open (#14). [`security/mcp.md`](docs/security/mcp.md).
- **10.6 Control-plane API** - live, 63 API tests. [`control-plane-api.md`](docs/architecture/control-plane-api.md), [`cloud-control-plane.md`](docs/architecture/cloud-control-plane.md).
- **10.7 Google sign-in** - live. [`authentication.md`](docs/security/authentication.md), [`deploy/google`](deploy/google/README.md).
- **10.8 Device registration** - live. [`ADR-0017`](docs/decisions/ADR-0017-device-credential-model.md).
- **10.9 Results sync** - live: metadata by default, opt-in evidence and transcript sync with back-fill (#19, #28). [`data-flow.md`](docs/architecture/data-flow.md).
- **10.10 Dashboard** - live at `/dashboard/`; check analytics against real synced data (#13). [`analytics/overview.md`](docs/analytics/overview.md).
- **10.11 Landing page** - live. [`deployment/cloudflare.md`](docs/deployment/cloudflare.md).
- **10.12 Analytics** - built; see 10.10 (#13). [`analytics/overview.md`](docs/analytics/overview.md).
- **10.13 Razorpay billing** - built (#12); a real purchase on the live key is NOT TESTED. [`razorpay.md`](docs/billing/razorpay.md), [`pricing.md`](docs/billing/pricing.md).
- **10.14 Signed entitlements** - built (#11, #42); engine side unreleased. [`entitlements.md`](docs/security/entitlements.md).
- **10.15 Enterprise guardrails and release integrity** - open (#21).
- **10.16 to 10.18 Admin console** - built (#43, #44, #45); enrolling a real staff authenticator is NOT TESTED. [`admin.md`](docs/security/admin.md), [`page-analytics.md`](docs/analytics/page-analytics.md).

## Open work

Open work is tracked as GitHub issues in
[Aevrin-ai/modelWrecker](https://github.com/Aevrin-ai/modelWrecker/issues); see
[`docs/reference/GIT-WORKFLOW.md`](docs/reference/GIT-WORKFLOW.md) for how issues, branches, and pull
requests fit together.

- Cloud: dashboard analytics check (#13), remote MCP (#14), API-key login for CI (#15), notifications
  (#20), enterprise guardrails (#21).
- Security: DNS-rebinding pinning (#16), code sandbox (#17), redaction audit (#18).
- Engine: live MCP-server target (#22), direct OpenAI and Anthropic adapters (#23), a live Ollama run
  (#24), money and cost budgets (#25), full `replay` re-execution (#52), and the reserved config keys
  `security.redact` and `engine.allow_host_tools` (#53).
- Repo: web app dependency upgrades (#47), codebase audit cleanup (#51).
- Not filed yet: `--output sarif|html` and CI modes (`--ci`, `--fail-on-finding`).

## Known problems / risks

- OWASP ASI (agentic) exact entry titles must be pulled from the official 2026 PDF at
  implementation time before any mapping is shipped. See `docs/research/taxonomies.md`.
- Provider SDK churn and the LiteLLM supply-chain incident (Mar 2026) mean the provider layer
  must stay thin and swappable. See `docs/decisions/ADR-0003-provider-abstraction.md`.
- Reusing PyRIT/garak deeply risks coupling our core to their internals; keep them behind
  adapters. See `docs/decisions/ADR-0006-reuse-pyrit-garak.md`.