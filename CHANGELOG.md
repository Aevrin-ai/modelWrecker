# Changelog

All notable changes to modelWrecker are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Only record things that actually
happened - never invent historical entries.

## [Unreleased]

### Added (Phase 10 - local-first product, first slice)
- **Architecture for the local-first product.** Heavy red-team compute stays on the user's machine; the
  Aevrin cloud is a thin control plane. New docs under `docs/architecture/` (local-cloud, docker,
  cloud-control-plane, data-flow), `docs/security/` (docker, mcp, authentication, entitlements, threat-model
  Phase 10 section), `docs/mcp/`, `docs/billing/`, `docs/analytics/`, `docs/deployment/`, and ADR-0014 to
  ADR-0018 (data layer: Supabase Postgres + RLS with Cloudflare Pages/Workers, confirmed 2026-10-02).
- **Docker product (10.2).** Hardened two-stage `Dockerfile`, `docker-compose.yml` (non-root, read-only root
  filesystem, no capabilities, no-new-privileges, CPU/memory/pids limits, only `./config` read-only and
  `./runs` mounted), and `.env.example`. Verified end to end with Docker Desktop on Windows.
- **MCP guardrails (10.5, local part).** Every MCP tool call passes a guardrail chain: tool and argument
  allowlist, per-process rate limit, path scope confined to `--config-dir` and the runs folder, target scope
  requiring `authorized: true` from config, a pluggable entitlement hook, and resource caps. Refusals are
  structured, logged with secrets redacted, and never partly run an attack. New `modelwrecker mcp --config-dir`.
- **Landing page (`src/web`)** for app.aevrin.net, built on the Folio visual system with a Nguyen-style
  feature section and the real Aevrin logo. All product claims come from `docs/`.
- **Management dashboard (`src/dash`)**, served at `/dashboard/`, built on the Catmint visual system (light
  and dark): overview, projects, targets, campaigns, findings, devices, connect-engine setup, analytics,
  reports, settings (sync privacy controls), billing and entitlements, account. It is a control plane only:
  it never runs attacks. It uses mock data behind a single `ApiClient` swap point until the real API exists.
- **CI/CD (staged).** `.github/workflows/deploy-web.yml` rebuilds both web apps and redeploys them to one
  Cloudflare Pages project on any push that touches `src/web/**` or `src/dash/**`;
  `.github/workflows/publish-pypi.yml` runs the tests and publishes to PyPI on a `v*` tag via trusted
  publishing. `deploy/` holds the step-by-step live setup (Supabase schema + RLS, Google OAuth values,
  Cloudflare DNS, PyPI) with no secrets in the repo.

- **Cloud control plane (10.6 to 10.9).**
  - Control-plane API Worker in `src/api` (Hono on Cloudflare Workers, Supabase Postgres with RLS),
    contract in `docs/architecture/control-plane-api.md`. No route runs an attack, calls a model, or
    fetches a URL. Strict schemas reject unknown fields, so sync cannot carry prompts, responses, system
    prompts, endpoints, or keys.
  - Device sign-in with the OAuth 2.0 device authorization grant: `modelwrecker login`, `logout`, `sync`.
    The device token is minted when the engine collects it, shown once, stored only as a hash, bound to
    the API URL it was issued for, and revocable from the dashboard. `run` syncs automatically when
    signed in (`--sync/--no-sync`); a sync failure never changes the run's exit code.
  - Metadata-only sync with an offline outbox (`.synced.json` marker after a confirmed upload); re-sending
    is safe and keeps a finding status set in the dashboard.
  - Dashboard: Google sign-in through Supabase Auth (PKCE), a real `HttpApiClient` (`VITE_API_MODE=http`;
    mock stays the default), a configuration error screen, real sign-out, and device approval on the
    Connect page.
  - Supabase migration `0002_devices_and_sync.sql`; new env vars `MODELWRECKER_CLOUD_URL` and
    `MODELWRECKER_DEVICE_TOKEN`; the redactor masks `mwd_` device tokens.
  - CI: `ci.yml` runs every test suite and build; `deploy-api.yml` redeploys the Worker after its tests.

- **Packaging for PyPI.** Project URLs and classifiers in `pyproject.toml`; the source archive now holds
  only the engine, its tests, and examples (not the web apps or deploy files). `python -m build` and
  `twine check` pass, and the wheel installs and runs in a clean environment. The publish workflow uses a
  `PYPI_API_TOKEN` secret when set, otherwise Trusted Publishing.
- The API Worker reads all three Supabase values as Worker secrets, so no project-specific value is in
  the public repo. Its `app.aevrin.net/api/*` route is enabled in `wrangler.toml`.

### Released
- `modelwrecker 0.0.1` published to PyPI (`pip install modelwrecker`) from the `v0.0.1` tag by CI.
- app.aevrin.net now serves the modelWrecker landing page and dashboard; the API Worker serves
  `app.aevrin.net/api/*`.

### Fixed
- Dashboard deep links served the landing page on Cloudflare Pages: Pages normalizes
  `/dashboard/index.html` to `/dashboard/`, so the SPA rewrite now targets the folder.
- CI: Wrangler 4 needs Node 22, and the deploy jobs now call Wrangler directly.
- Evidence recorded the attack plan's random id in `strategy` instead of the strategy name, contrary to
  the data model. Evidence now stores the strategy name and its parameters (regression test added).
- The default Docker image (no `attacks` extra) failed every run with `No module named 'pyrit'` because
  the payload registry imported PyRIT unguarded. PyRIT transforms are now optional; regression test added.
- MCP: `validate_config` could read files outside the project, a crafted `run_id` could write outside the
  runs folder, and guardrail refusals reached clients as a generic error.

- **Egress guard enforced (10.3).** The guard existed but no provider called it. Every model request now
  passes the run's `security.egress` policy before it is sent, redirects are refused, and `validate`
  checks each endpoint offline. New `security.egress.allow_hosts` for a narrow local-model opt-in.
  **Behavior change:** a plain-HTTP or `localhost` endpoint is refused unless the config opts in;
  `examples/local-model.yaml` now does. 20 new tests in `tests/test_egress_wiring.py`.

### Known gaps
- DNS rebinding between the egress check and the connection is not prevented yet (ROADMAP 10.3).

### Added (Phase 9 new target types)
- **Agent, RAG, and MCP targets.** `config.target.type` (chat default | agent | rag | mcp) plus
  `target_options` select the target via a new `targets/factory.py`; the loop is unchanged.
  - `targets/agent.py`: a tool-using agent. Tool calls are only observed and recorded - never executed -
    and sensitive calls are flagged for the judge.
  - `targets/rag.py`: a retrieval-augmented target; retrieves by keyword overlap, injects documents as
    untrusted context, and (by default) accepts attacker-ingested documents (INGEST_DOCUMENT capability).
  - `targets/mcp_target.py`: an MCP-connected agent whose (inline) tools may carry poisoned descriptions.
- **Matching strategies**: `tool_misuse` (excessive agency / goal hijack; OWASP LLM03, ASI01),
  `rag_injection` (indirect prompt injection; OWASP LLM01/LLM05), `mcp_tool_poisoning` (OWASP MCP03). Each
  requires the capability only its target type declares, so the planner only runs compatible ones.
- **`tool_misuse` judge signal** (reads the target's `sensitive_tool_calls`), wired into the ensemble and
  made decisive for agent/MCP objectives in the combiner. New INGEST_DOCUMENT capability.
- Attempts carry the objective `category` through for analytics. Test suite: 85 passing + 1 skipped without
  the `scan` extra (86 with it); adds `tests/test_phase9_targets.py`. The agent attack is also verified
  through the real CLI (critical finding mapped to LLM03/ASI01). A live MCP-server connection is a
  documented follow-up (inline tools exercise the full path today).

### Added (Phase 8 reliability & analytics)
- **Analytics engine** (`src/modelwrecker/analytics/`): computes attack success rate (ASR) at the attempt
  level with **Wilson 95% confidence intervals**, broken down by strategy and objective category, plus
  findings by severity and taxonomy, and a cross-run **model leaderboard** (most-robust first).
- **Static report artifacts**: a self-contained HTML page (inline CSS, CSS-only bars, no scripts/fonts/
  external assets), plus JSON and CSV. New `modelwrecker analyze <run-dir> [more...]` command writes
  `analytics-<run>.{html,json,csv}` per run and `leaderboard.{html,json,csv}` for two or more runs. No
  server (the live dashboard is Phase 10).
- **Reliability**: `ReliabilityResult` now carries `ci_low`/`ci_high` (Wilson) and a `high_variance` flag
  (set when the backend is unpinned); `reliability/replay.py` exposes `wilson_interval`.
- **garak adapter** (`scan` extra, ADR-0006): `garak_probe` loads a garak probe's prompts and sends them at
  our target, judged by our judge (roles stay separate); registers only when garak is importable. **Verified
  live**: real DAN/glitch probes load, and a full `garak_probe` attack loop runs against a loopback stub
  (4 DAN prompts, 2/4 SUCCESS, a critical finding, ASR 2/4) with no API key.
- Attempt records/events now carry the objective `category`; a `run_meta` event records the target model for
  leaderboard labels. Test suite: 76 passing without the `scan` extra (+1 skipped garak test), 77 with it.
  Adds `tests/test_analytics.py` and `tests/test_garak.py`. Verified through the real CLI over two
  loopback-stub runs (leaderboard ranked the robust target first; HTML confirmed self-contained).

### Added (Phase 7 campaign engine)
- **Campaign engine** (`src/modelwrecker/campaigns/engine.py`): schedules a run's objectives with
  parallelism (a per-run `asyncio.Semaphore`), budgets (`max_objectives`, `max_attempts`, `max_tokens`,
  `max_seconds`), stop conditions (`complete`, `first_finding`, `budget`), and bounded retries on transient
  provider errors. A single objective's failure is isolated so it never kills the campaign, and stopping is
  cooperative (no in-flight objective is hard-cancelled). The attack loop now delegates scheduling to it.
- New `campaign:` config section (`config.py`: `CampaignConfig` + `BudgetConfig`, validated) and `run`
  overrides `--concurrency`, `--stop-on`, `--max-objectives`, `--max-seconds`. `check` prints the campaign
  settings.
- Budgets are checked before each objective and before each strategy, and target tokens are accounted per
  observation. Test suite grown to 65 (adds `tests/test_campaign.py`). Verified through the real CLI
  against a loopback stub (concurrency ran objectives in parallel; `first_finding` stopped and skipped the
  rest cleanly).

### Added (PyRIT activation + Phase 6 payload engine)
- **PyRIT 1.1 integrated** (`attacks` extra): a bridge wraps a modelWrecker provider as a PyRIT target
  (`strategies/pyrit_bridge.py`), and `strategies/pyrit_attacks.py` adds `pyrit_send`, `pyrit_pair`
  (PAIR), and `pyrit_tap` (TAP). PAIR runs offline end to end to a SUCCESS outcome; TAP executes. These
  register only when PyRIT imports, so the engine still runs without the extra.
- **Phase 6 payload engine**: first-party transforms (`base64`, `rot13`, `reverse`, `zero_width`,
  `leetspeak`, `homoglyph`) with chains + reversible round-trips, a `PayloadEngine`, and a registry; plus
  PyRIT converters (morse/binary/leetspeak, ...) wrapped as transforms when the `attacks` extra is present.
- New `encoded_jailbreak` strategy that applies a transform chain and records it on the attempt.
- CLI `transforms` command. Test suite grown to 58 (adds payload + PyRIT tests; PyRIT tests skip without
  the extra).

### Workflow
- Standardized on the project `.venv` via uv (`uv venv` + `uv pip install -e ".[dev,mcp,attacks]"`); do
  not pip-install into the global interpreter. Migrated the MCP server to the MCP SDK v2 `MCPServer`
  (the `.venv` resolves mcp 2.x).

### Added (Phase 5 + reporting + Docker)
- Four new attack strategies, tested offline: `best_of_n`, `prefill`, `many_shot`, `crescendo`.
  (The PyRIT adapter seam added here was activated later this cycle - see "PyRIT activation" above.)
- Reports now include a full **attempt transcript**: for every attempt, the exact prompt sent to the
  model, the model's reply, and the result (SUCCESS / PARTIAL / FAILED with score). `run` and `report`
  render it (md and json); the MCP `get_report` includes it too.
- Docker: image **built and verified** - runs as non-root, lists strategies, validates a mounted config,
  and runs a full in-container attack loop against a host stub (critical finding, 3/3 replays).
- Test suite grown to 44 passing offline tests (adds strategy + report-transcript tests).

### Changed
- Removed unused empty placeholder packages (`campaigns/`, `evidence/`); evidence capture lives in
  `findings/`. (`payloads/` was later re-added for Phase 6.) Repo-structure doc updated to match.

### Added
- Project memory and documentation system: `CLAUDE.md`, `docs/index.md`,
  `docs/DOCUMENTATION.md`, `docs/DEPENDENCIES.md`, `DECISIONS.md`, `ROADMAP.md`, this file.
- Phase 0 research notes under `docs/research/` (Aevrin, prior red-team harnesses and their audits, the OSS
  red-teaming and provider-gateway landscape, security taxonomies).
- Architecture documents under `docs/architecture/` and area docs for providers, targets,
  the attack engine, judges, campaigns, evidence/findings, and security.
- Thirteen ADRs under `docs/decisions/` covering language, license, provider abstraction, the
  attacker/target/judge split, the strategy plugin system, OSS reuse, the judge ensemble, the
  security model, the payload engine, the no-checksum-gate rule, storage, library-first design, and
  harness integration.
- Interface definitions (as documentation only) under `docs/interfaces/`.
- CLI, configuration, and environment reference under `docs/reference/`.
- `docs/reference/WRITING-STANDARD.md`: the project writing standard (simple English, no em dashes,
  no emoji, small Mermaid diagrams).
- `docs/features/` with the harness-integration feature (drive modelWrecker from Claude Code / Codex
  / any MCP client; ADR-0013).
- Phase 4 scaffolding: `pyproject.toml` (Apache-2.0, console script, dev tooling) and the
  `src/modelwrecker/` package - data models, config, interfaces (Protocols), the security layer
  (egress guard + redaction), taxonomy tables + validation, documented subpackage stubs, and a CLI
  skeleton. Offline test suite in `tests/` (19 passing).

### Changed
- Locked maintainer decisions: any-llm is the default provider multiplexer (ADR-0003); PyRIT reuse is
  a thin adapter plus its memory and scoring (ADR-0006); target order after chat is agent, RAG, then
  MCP; harness integration is in scope.
- Documentation style pass: removed internal spec references, converted em/en dashes to hyphens, and
  reframed all prior-tooling references as Aevrin design principles. Fixed the Mermaid parse error in
  `docs/architecture/OVERVIEW.md` (parentheses in subgraph titles).

### Added (engine implementation)
- Working local engine: OpenAI-compatible provider adapter (OpenRouter/Ollama/vLLM) with a provider
  factory and `provider_scope` lifecycle; a fake provider for offline tests.
- Chat target with an authorization gate (refuses targets not marked `authorized: true`).
- Attack planner + loop; two strategies (`direct_jailbreak`, `prompt_extraction`) with a registry.
- Multi-signal judge (LLM + secret + PII + rule) with a weighted combiner and calibration.
- Reliability replay; evidence capture; finding engine with severity + verified taxonomy; storage
  (atomic JSONL event log + SQLite index, tight file permissions).
- Real CLI: `init`, `validate`, `check`, `provider test`, `run`, `report`, `replay`, `strategies`.
- `examples/` (basic, openrouter, local-model, system-prompt) - all validated.
- `docs/getting-started/` (yaml, first-campaign), `docs/testing/test-matrix.md`, and
  `reports/final-test-report.md`.
- Test suite grown to 30 passing offline tests, plus a verified real-HTTP end-to-end run against a
  loopback stub (config -> finding -> evidence -> report).

### Added (harness integration + distribution)
- MCP server (`modelwrecker mcp`) exposing safe orchestration tools only (list_strategies,
  validate_config, run, get_findings, get_report, replay) behind a testable service layer, with
  guardrails (authorized-target-only, path-traversal rejection, no host tools). Verified by a real MCP
  client round-trip over in-memory streams. See ADR-0013 and `docs/features/harness-integration.md`.
- `Dockerfile` + `.dockerignore`: non-root image, installs the engine with the mcp extra (one engine,
  many distributions).
- Test suite grown to 36 passing offline tests (adds MCP service + round-trip tests).

### Verified live
- OpenRouter (`openai/gpt-4o-mini`) connectivity, engine run, and the installed CLI `run`/`provider test`
  all work end to end. The model resisted the benign test objectives (0 findings, no false positives);
  the finding/evidence/replay path is verified by a real-HTTP stub run with a vulnerable target.
- Packaging: `pip install .` in a clean venv works and the console script runs live. `uv build` produces
  a wheel that installs in a fresh venv and runs a full loop (critical finding vs a loopback stub).
- MCP server passes a real client round-trip with guardrails enforced.

### Fixed
- Packaging bug: `.gitignore` patterns `evidence/` and `findings/` also matched the source packages
  `src/modelwrecker/evidence/` and `src/modelwrecker/findings/` (hatchling honors `.gitignore`), so they
  were missing from the install and from git staging. Root-anchored the artifact ignore patterns.

### Notes
- (Superseded later this cycle: Docker was then built and verified; PyRIT and the payload engine were
  integrated.) Ollama local run, direct OpenAI/Anthropic adapters, any-llm/garak adapters, and the
  campaign engine remain NOT TESTED, marked as such in `docs/testing/test-matrix.md`. Nothing untested is
  claimed as passing.