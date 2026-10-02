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

- **Phase 10 - Local-first product: cloud control plane + authenticated surfaces.** The product shape
  is now fixed by `.prompt/WORKFLOW.md`: **heavy red-team computation always runs on the user's machine**
  (local engine in Docker), and the Aevrin cloud is a thin **control plane** only - identity, projects,
  devices, entitlements, billing, and the dashboard that shows synced metadata. The cloud never runs
  attacks, never runs LLM inference, and never becomes a hidden compute dependency. One engine, many
  front doors (CLI, Docker, MCP, future REST API), one shared auth layer.

  The product boundary:

  ```text
  Aevrin Cloud  = identity + control + billing + analytics + policy
  User's Docker = computation + red teaming + attack engine + MCP + evidence
  ```

  **Data layer (decided 2026-10-02, ADR-0015):** Supabase Postgres + RLS for the data layer, Cloudflare
  Pages for static hosting, Cloudflare Workers only for thin API/edge glue. Billing is **Razorpay**, kept
  entirely in the cloud control plane (no Razorpay secret ever ships in Docker, MCP, CLI, or the engine).
  Live cloud setup (DNS, Supabase schema apply, Google OAuth client, PyPI first publish) is **staged** in
  `deploy/` and run by the maintainer; nothing irreversible is done automatically.

  **Status (2026-10-02):**

  - DONE 10.1 - architecture docs, security docs, MCP docs, billing/analytics/deployment docs, ADR-0014..0018.
  - DONE 10.2 - hardened `Dockerfile` + `docker-compose.yml` + `.env.example`. Verified: image builds,
    CLI runs, a full campaign runs via compose against a loopback stub (critical finding, replays, report),
    uid 10001, read-only root filesystem, zero capabilities, cgroup limits, no Docker socket (see the test
    matrix). Not tested: native Linux/macOS hosts and a live provider run. Fixed on the way:
    the default image (no PyRIT extra) crashed every run on an unguarded PyRIT import (regression test added).
  - DONE 10.5 (local part) - guardrail chain on the stdio MCP server: tool + argument allowlist, rate limit,
    path scope (`--config-dir`), target scope (`authorized: true` from config only), entitlement hook,
    resource caps, structured redacted refusals. 42 MCP tests. Remaining: Streamable HTTP + OAuth 2.1.
  - BUILT 10.4 (login part) - `modelwrecker login` (OAuth 2.0 device code), `logout`, `sync`; the token
    is saved with owner-only permissions and only ever sent to the URL it was issued for. PyPI publish is
    staged. The API-key fallback for CI is not built yet.
  - BUILT 10.6 + 10.7 - control-plane API Worker at `src/api` (`app.aevrin.net/api/v1`, contract in
    `docs/architecture/control-plane-api.md`), Supabase migration `0002`, Google sign-in in the dashboard
    via Supabase Auth (PKCE). Dashboard queries run as the user so RLS applies, and the API also filters by
    owner. 13 API tests, including deliberate-break checks for account isolation and the strict sync schema.
  - BUILT 10.8 + 10.9 - device registration (token minted on collection, shown once, stored hashed,
    revocable) and metadata-only sync with an offline outbox. Verified end to end: the real CLI signed in
    and synced against the real API code over HTTP (in-memory database); a secret planted in the local
    run never reached the cloud.
  - BUILT 10.10 - dashboard at `src/dash` (served at `/dashboard/`), Catmint visual system, all routes,
    light + dark. Mock data stays the default; `VITE_API_MODE=http` switches to the real API.
  - BUILT 10.11 - landing page at `src/web`, Folio visual system + Nguyen feature section, real Aevrin logo.
  - STAGED CI/CD - `.github/workflows/deploy-web.yml` redeploys both apps to Cloudflare Pages on any push
    touching `src/web/**` or `src/dash/**`; `publish-pypi.yml` publishes on a `v*` tag. Both need the
    maintainer to add GitHub secrets / a PyPI trusted publisher (see `deploy/`).
  - NOT DONE YET for the cloud: deploying (staged in `deploy/`), signed entitlements (10.14), Razorpay
    (10.13), report and evidence sync, notifications, remote MCP over HTTP with OAuth (rest of 10.5).
  - DONE 10.3 (egress part) - the egress guard now runs on every attacker, target, and judge request,
    redirects are refused, `validate` checks endpoints offline, and a local model is a narrow opt-in via
    `security.egress.allow_hosts`. Remaining for 10.3: DNS-rebinding address pinning, the code sandbox,
    and the redaction audit.

  ### Task 10 - sub-phase order (implement -> test -> document -> review at each step)

  - **10.1 Architecture + docs (no code).** Write `docs/architecture/local-cloud.md`, `docker.md`,
    `cloud-control-plane.md`, `data-flow.md`; `docs/security/{docker,mcp,authentication,entitlements}.md`
    and a threat-model pass; `docs/mcp/{overview,tools}.md`; `docs/billing/razorpay.md`;
    `docs/analytics/overview.md`; `docs/deployment/{docker,cloudflare}.md`. Small Mermaid diagrams per
    WORKFLOW section 32. ADRs for: local/cloud boundary, data layer choice, billing provider, device
    credential model, entitlement signing.
  - **10.2 Local engine packaging + Docker product.** `Dockerfile`, `docker-compose.yml`, `.env.example`,
    one-command setup. Least privilege (non-root, read-only mounts, resource limits, no host socket),
    documented in `docs/security/docker.md`.
  - **10.3 Security hardening.** Sandbox for attack-generated code (timeouts, memory/cpu caps, no host
    reach); egress-guard audit under redirects/DNS-rebinding; redaction audit; threat-model pass over the
    Phase 9 agent/RAG/MCP surface.
  - **10.4 CLI auth + distribution.** Publish `modelwrecker` to PyPI (trusted publishing from the repo
    via GitHub Actions on tag); `modelwrecker login` (OAuth 2.0 device-code flow against app.aevrin.net,
    API-key fallback for CI) storing a `0600` token; `run --remote` calls the authenticated API.
  - **10.5 Authenticated remote MCP.** Run the MCP server over Streamable HTTP with OAuth 2.1 bearer auth
    (local stdio MCP stays available, no network auth). Safe high-level tools only (create_campaign,
    list_targets, start_campaign, get_campaign, get_findings, replay_finding, stop_campaign, get_status).
    Every request passes auth -> authorization -> target scope -> entitlement -> rate/resource limit ->
    tool permission before the engine. No shell, no arbitrary network, no arbitrary filesystem.
  - **10.6 Cloud control plane + REST API.** Auth-by-default (OAuth 2.1 / bearer), anti-CSRF, refuses
    non-loopback binds without auth. Multi-tenant isolation enforced server-side (never trust client
    role/plan/project/ownership). Entities: account, project, device, target metadata, campaign/run/
    finding metadata, analytics, subscription, entitlement.
  - **10.7 Google authentication.** OAuth/OIDC sign-in issues the identity the API, UI, and CLI trust.
    Never store Google passwords; never put the Google token in Docker. Google Cloud Console setup
    (OAuth client, consent screen, authorized JavaScript origins + redirect URIs) is a maintainer step;
    exact values are called out when this wiring starts.
  - **10.8 Device registration + local-to-cloud connection.** Each local install registers as a device
    and receives a scoped device/project credential (not the user's Google token). Local engine stays
    usable offline where practical; results sync when the cloud returns.
  - **10.9 Results synchronization + privacy.** Sync summarized metadata only by default (campaign, run,
    finding, severity, strategy, target, model, provider, success rate, evidence metadata, timestamps).
    Detailed evidence and transcripts stay local unless the user explicitly opts in. The UI makes the
    local/cloud boundary explicit; never silently upload sensitive model responses.
  - **10.10 Dashboard (app.aevrin.net).** React + TypeScript + Vite + Tailwind + shadcn, Catmint visual
    language (see `.prompt/DASHBOARD.md`). Management/monitoring/analytics only - it never executes
    attacks. Mock data isolated in `src/data/mock/`, swappable for the real API without rewriting the UI.
  - **10.11 Landing page (app.aevrin.net).** New Aevrin landing page derived only from `docs/` product
    truth (see `.prompt/LANDING.md`), Folio + Nguyen design language, hero shows a real dashboard mockup.
  - **10.12 Analytics.** Dashboard views over synced metadata: ASR, findings by severity/taxonomy, trends,
    campaign activity, model leaderboard. Reuses the existing `analyze` outputs; prefers aggregates.
  - **10.13 Razorpay billing.** Checkout + server-verified webhooks in the cloud control plane only.
    Never trust the browser for payment success.
  - **10.14 Entitlements.** A configuration-driven entitlement layer (free/pro/enterprise). The engine
    asks "can this operation run?"; the entitlement service answers allowed/denied. Enforced outside the
    UI (signed/scoped entitlement the local engine checks); no easy client-side bypass; no pricing logic
    inside the attack engine.
  - **10.15 Enterprise guardrails + integrity.** Org policies, approved targets/providers/strategies,
    campaign caps, audit logs, device controls, evidence retention; signed-release / image-digest / signed
    MCP integrity controls after a threat model (no blanket checksum gate in normal dev, per ADR-0010).

  Hosting: Cloudflare Pages (static dashboard + landing) + minimal Workers; document each service and its
  current free-tier limits (Workers 100k req/day; Pages static assets free) and fail gracefully at quota.
  The architecture must allow a later move to paid infra without rewriting the local engine.

## Known problems / risks

- OWASP ASI (agentic) exact entry titles must be pulled from the official 2026 PDF at
  implementation time before any mapping is shipped. See `docs/research/taxonomies.md`.
- Provider SDK churn and the LiteLLM supply-chain incident (Mar 2026) mean the provider layer
  must stay thin and swappable. See `docs/decisions/ADR-0003-provider-abstraction.md`.
- Reusing PyRIT/garak deeply risks coupling our core to their internals; keep them behind
  adapters. See `docs/decisions/ADR-0006-reuse-pyrit-garak.md`.