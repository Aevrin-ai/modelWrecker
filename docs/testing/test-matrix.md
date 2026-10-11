# Test matrix

Honest status of what has actually been tested. Legend: PASS (ran and verified), FAIL, BLOCKED,
NOT TESTED. Last updated 2026-10-08.

Run the automated suite in the project venv: `.venv\Scripts\python -m pytest -q` (offline, no API key;
create the venv with `uv venv` + `uv pip install -e ".[dev,mcp,attacks]"`). That gives **226 passing + 1
skipped** (the symlink case in `tests/test_mcp.py`, skipped on Windows without symlink rights). The garak
tests skip without the `scan` extra and the PyRIT tests skip without the `attacks` extra. Lint:
`.venv\Scripts\python -m ruff check src tests` is clean and CI runs it. The control-plane API has **63
tests** (vitest): `npm test` in `src/api`.

Rows are grouped by area and were added as each phase landed. Older dated snapshots from Phase 4 live in
[`../../reports/`](../../reports/final-test-report.md); this page supersedes them.

| Component | Test | Status | Evidence |
|-----------|------|--------|----------|
| Data models | round-trip via JSON | PASS | `tests/test_scaffold.py` |
| Config | unknown protocol / unknown key rejected | PASS | `tests/test_scaffold.py` |
| Config | key resolves from env, not file | PASS | `tests/test_scaffold.py` |
| Config | unauthorized target refused | PASS | `tests/test_engine_e2e.py` |
| Security | egress guard blocks loopback/private/metadata | PASS | `tests/test_scaffold.py` |
| Security | redaction strips keys/headers/PII fields | PASS | `tests/test_scaffold.py` |
| Taxonomy | unknown id rejected; titles filled | PASS | `tests/test_scaffold.py`, `tests/test_components.py` |
| Provider | OpenAI-compatible wire parsing | PASS | `tests/test_components.py` |
| Provider | real adapter over HTTP (loopback stub) | PASS | scratchpad `stub_run.py` (finding produced) |
| Provider | factory: anthropic not implemented -> clear error | PASS | `tests/test_components.py` |
| Strategy | registry load + unknown name error | PASS | `tests/test_components.py` |
| Strategy | direct_jailbreak | PASS (fake + stub) | e2e |
| Strategy | prompt_extraction | PASS (fake + stub) | e2e, stub_run |
| Strategy | best_of_n (resample N) | PASS | `tests/test_strategies.py` |
| Strategy | prefill (assistant priming, multi-turn) | PASS | `tests/test_strategies.py` |
| Strategy | many_shot (faux turns, multi-turn) | PASS | `tests/test_strategies.py` |
| Strategy | crescendo (multi-turn escalation) | PASS | `tests/test_strategies.py` |
| Strategy | encoded_jailbreak (transform-wrapped) | PASS | `tests/test_payloads.py` |
| Target | agent target: tool-call parse + sensitive-call flag | PASS | `tests/test_phase9_targets.py` |
| Target | RAG target: retrieval + document ingest | PASS | `tests/test_phase9_targets.py` |
| Target | MCP target: follows a poisoned tool description | PASS | `tests/test_phase9_targets.py` |
| Target | factory builds chat/agent/rag/mcp from config.type | PASS | `tests/test_phase9_targets.py` |
| Judge | tool_misuse signal (sensitive tool called) | PASS | `tests/test_phase9_targets.py` |
| Strategy | tool_misuse (agent) -> finding (LLM03/ASI01) | PASS | e2e + real CLI (agent stub: critical finding) |
| Strategy | rag_injection (indirect injection) -> finding (LLM01) | PASS | `tests/test_phase9_targets.py` e2e |
| Strategy | mcp_tool_poisoning (MCP03) | PASS | `tests/test_phase9_targets.py` (poisoned tool triggers sensitive call) |
| Strategy | PyRIT bridge (provider -> PyRIT target) | PASS | `tests/test_pyrit.py` (pyrit_send runs) |
| Strategy | pyrit_pair (PAIR via PyRIT) | PASS | `tests/test_pyrit.py` - runs offline, reaches SUCCESS outcome |
| Strategy | pyrit_tap (TAP via PyRIT) | PASS (executes) | `tests/test_pyrit.py` - runs; prunes offline without live adversarial |
| Payload engine | 6 first-party transforms + chains + round-trips | PASS | `tests/test_payloads.py` |
| Payload engine | PyRIT converter transforms (morse/binary/leetspeak) | PASS | registered when attacks extra present |
| Report | shows prompt sent + model reply + result per attempt | PASS | `tests/test_engine_e2e.py` (success and refusal) |
| Judge | calibration on benign fixtures | PASS | `tests/test_components.py`, e2e |
| Judge | success vs refusal verdict | PASS | e2e |
| Reliability | replay -> reliable/flaky/does_not_hold | PASS | e2e (5/5 reliable in stub run) |
| Reliability | Wilson 95% CI + high-variance flag | PASS | `tests/test_analytics.py` (extremes + tightening) |
| Analytics | ASR counts + by-strategy/category breakdowns | PASS | `tests/test_analytics.py` |
| Analytics | findings by severity + taxonomy | PASS | `tests/test_analytics.py` |
| Analytics | leaderboard ranks most-robust first | PASS | `tests/test_analytics.py`; real CLI (safe run ranked above weak) |
| Analytics | JSON/CSV renderers valid | PASS | `tests/test_analytics.py` |
| Analytics | self-contained HTML (no external refs) | PASS | `tests/test_analytics.py`; real CLI (0 external refs, 3.2 KB) |
| CLI | `analyze` writes HTML/JSON/CSV + leaderboard | PASS | real CLI over two loopback-stub runs |
| garak | prompt -> attempt mapping (offline) | PASS | `tests/test_garak.py` (fake target) |
| garak | live probe load + registry wiring | PASS | `scan` extra installed; `tests/test_garak.py` runs; real DAN/glitch probes load prompts |
| garak | full live loop (probe -> our target -> judge -> finding -> analytics) | PASS | real CLI `garak_probe` vs stub: 4 DAN prompts, 2/4 SUCCESS, critical finding, ASR 2/4 (no API key - loopback stub) |
| Finding | severity scaling; taxonomy resolve | PASS | `tests/test_components.py` |
| Evidence | captured + stored, atomic write | PASS | stub_run (`evidence-*.json`) |
| Storage | JSONL events + SQLite index | PASS | stub_run (`events.jsonl`, `index.sqlite`) |
| CLI | version / strategies / init / validate / check | PASS | manual run |
| CLI | `replay` re-runs a finding against its target | NOT TESTED | not built: `replay` prints the recorded payload only (#52) |
| CLI | error handling (missing file, unauthorized, bad protocol) | PASS | manual run, exit code 2 |
| CLI | `provider test` (live OpenRouter) | PASS | returned "Pong", ~0.9 s, tokens reported |
| CLI | `run` against a live model (installed binary) | PASS | ran prompt_extraction vs gpt-4o-mini, report rendered |
| End-to-end | config -> finding -> evidence -> report | PASS | stub_run over real HTTP (vulnerable target) |
| End-to-end | config -> judged -> no false finding | PASS | live gpt-4o-mini resisted; judge scored 0, no finding |
| Live provider | OpenRouter (openai/gpt-4o-mini) | PASS | connectivity + 3 live objectives + installed CLI run |
| Live provider | Ollama (local) | NOT TESTED | not run in this environment (#24) |
| Packaging bug | source `findings/`+`evidence/` excluded by .gitignore (hatchling honors it) | FIXED | root-anchored the ignore patterns; reinstall includes them |
| Direct provider | OpenAI / Anthropic adapters | NOT TESTED | adapters not built yet; `anthropic` raises a clear error (#23) |
| any-llm multiplexer | adapter | NOT TESTED | not built; `any_llm` uses the OpenAI-compatible wire today |
| garak strategies | adapter | PASS | adapter, mapping, live probe load, and a full live attack loop all tested; see the `garak` rows |
| Campaign engine | run all objectives to completion | PASS | `tests/test_campaign.py`; real CLI (3 objectives, concurrency 3, 3 findings) |
| Campaign engine | parallel execution (concurrency) | PASS | `tests/test_campaign.py`; real CLI `--concurrency 3` ran all in parallel |
| Campaign engine | stop_on first_finding | PASS | `tests/test_campaign.py`; real CLI stopped after first, skipped the rest |
| Campaign engine | budgets (max_objectives / max_attempts) | PASS | `tests/test_campaign.py` |
| Campaign engine | retry + per-objective error isolation | PASS | `tests/test_campaign.py` (transient error retried; campaign survives) |
| Campaign engine | invalid campaign config rejected | PASS | `tests/test_campaign.py`; real CLI exit 2 clean message |
| Campaign engine | money budget / wall-clock deadline live | NOT TESTED | money pricing not built (#25); deadline tested only via unit budget |
| Harness integration | MCP server + JSON driver | PASS | see the `MCP server` and `MCP guardrails` rows |
| MCP server | builds; tools registered | PASS | `tests/test_mcp.py` |
| MCP server | real client round-trip (list_tools + call_tool) over in-memory streams | PASS | `tests/test_mcp.py` |
| MCP guardrails | only safe tools exposed (no shell/file/http) | PASS | round-trip asserts their absence |
| MCP guardrails | unauthorized target rejected before any run | PASS | `tests/test_mcp.py` |
| MCP guardrails | path traversal / out-of-scope run id rejected | PASS | `tests/test_mcp.py` |
| MCP guardrails | registered tools equal the allowlist exactly; unknown tool refused | PASS | `tests/test_mcp.py` |
| MCP guardrails | endpoint override in a tool argument refused (`base_url`, `target`, ...) | PASS | `tests/test_mcp.py` |
| MCP guardrails | unknown target (none in config) refused | PASS | `tests/test_mcp.py` |
| MCP guardrails | config path confined to `--config-dir` (traversal, absolute, URL, non-yaml) | PASS | symlink case SKIPPED on Windows without symlink rights |
| MCP guardrails | oversized campaign refused; values exactly at each limit allowed (calibrated) | PASS | `tests/test_mcp.py` |
| MCP guardrails | call rate, run rate, and one-active-run limits | PASS | `tests/test_mcp.py` |
| MCP guardrails | entitlement hook: deny, error, and malformed answer all refuse (fail safe) | PASS | `tests/test_mcp.py` |
| MCP guardrails | refusal is structured, logged with secrets redacted, engine never called | PASS | `tests/test_mcp.py`; mutation-checked |
| MCP guardrails | denials reach a real in-process MCP client as `is_error` results | PASS | `tests/test_mcp.py` |
| Packaging | `pip install .` in a clean venv | PASS | fresh venv install succeeded |
| Packaging | console script runs (--help/version/validate/strategies) | PASS | clean-env run |
| Packaging | `uv build` wheel + install in a fresh venv | PASS | wheel installs; contains findings/evidence/mcp |
| Packaging | wheel-installed CLI runs a full loop | PASS | critical finding vs loopback stub, 3/3 replays |
| Docker | image build | PASS | `docker build` succeeded |
| Docker | in-container run (help/validate/strategies) | PASS | runs; all 6 strategies listed |
| Docker | in-container full attack loop | PASS | critical finding vs host stub, 3/3 replays, transcript rendered |
| Docker | security: runs as non-root | PASS | `id` -> uid=10001(wrecker) |
| Docker | security: no socket/privileged by default | PASS (by run flags) | documented in deployment; no socket mounted |
| Docker 10.2 | two-stage build, pinned base digest (`python:3.12.15-slim-bookworm`) | PASS | `docker compose build`, Docker Desktop 29.6 (Windows/WSL2), 2026-10-02; image 295 MB |
| Docker 10.2 | `docker compose run --rm modelwrecker --help` / `version` / `validate` | PASS | exit 0; missing config exits 2 with a clean message |
| Docker 10.2 | full campaign via compose vs loopback stub (no API key) | PASS | `run /config/campaign.yaml`: prompt_extraction, critical finding, 3/3 replays, artifacts in host `./runs`; `analyze` wrote HTML/JSON/CSV |
| Docker 10.2 | `docker compose up` runs the mounted campaign | PASS | critical finding, container exited 0 |
| Docker 10.2 | non-root uid 10001 | PASS | in-container `os.getuid()` = 10001 |
| Docker 10.2 | read-only root fs; only `/tmp` and `/work/runs` writable; `/config` read-only | PASS | in-container write probes |
| Docker 10.2 | no capabilities, no-new-privileges | PASS | `/proc/self/status`: CapEff and CapBnd 0, NoNewPrivs 1 |
| Docker 10.2 | memory/CPU/pids limits applied | PASS | cgroup `memory.max` 2 GiB, `cpu.max` 200000/100000, `pids.max` 256 |
| Docker 10.2 | no Docker socket in container | PASS | `/var/run/docker.sock` absent |
| Docker 10.2 | `mcp,attacks` image (PyRIT) under plain `docker run` hardening flags | PASS | 1.56 GB; `pyrit_send` -> critical finding, 2/2 replays, read-only root fs |
| Docker 10.2 | default image without PyRIT runs payload-using strategies | FIXED | was FAIL: every run errored `No module named 'pyrit'` (payload registry imported PyRIT unguarded); fixed + regression test `tests/test_payloads.py::test_payload_registry_loads_without_pyrit` |
| Docker 10.2 | native Linux / macOS host, Linux `./runs` ownership | NOT TESTED | only Docker Desktop on Windows was available |
| Docker 10.2 | egress guard enforced inside container | PASS (code path) | the guard now runs inside every provider request, in or out of the container; see the 10.3 rows |
| Security 10.3 | egress guard enforced on every attacker, target, and judge request | PASS | `tests/test_egress_wiring.py`: blocked URL raises before any request leaves the process |
| Security 10.3 | private, loopback, IPv6 loopback, and metadata blocked by default | PASS | parametrized over 8 URLs |
| Security 10.3 | redirects refused (never followed) | PASS | 302 to the metadata address raises |
| Security 10.3 | metadata blocked under every opt-in (`allow_private`, `allow_hosts`) | PASS | |
| Security 10.3 | `allow_hosts` opens only the named host | PASS | `localhost` allowed, `127.0.0.1` still blocked |
| Security 10.3 | attack loop passes the configured policy to all three providers | PASS | |
| Security 10.3 | `validate` refuses a blocked endpoint offline (no DNS) | PASS | all four `examples/` configs still validate |
| Security 10.3 | DNS rebinding between check and connect | NOT TESTED | known limit; address pinning is open (#16) |
| Landing `src/web` | `npm run build` (tsc + vite) | PASS | 0 TypeScript errors, 2026-10-02 |
| Landing `src/web` (rebuilt, #55) | every section renders at 1440x900 and 390x844, light and dark; no horizontal scroll; no console errors | PASS | checked in Chrome DevTools against the activepieces.com study |
| Landing scroll story | readable text at each progress point; 8 wires and 16 end dots, every wire end on a dot; still final frame below 1024px | PASS | measured in Chrome |
| Landing reduced motion | every mockup opens on its final step; the story becomes plain sections; no cursor | PASS | `matchMedia` override |
| Landing navbar | menus open on hover, click, Enter and Down arrow; panel height eases between menus; Escape closes; phone menu folds into rows | PASS | checked in Chrome |
| Landing links | 10 section anchors exist; 8 external links answer 200 | PASS | |
| Landing Lighthouse (phone) | accessibility, best practices, SEO | PASS | 100 / 100 / 100; LCP 2.4 s and CLS 0 on Slow 4G with 4x CPU slowdown (the home page is prerendered) |
| Landing `src/web` | no horizontal overflow at 390px (mobile emulation) | PASS | page scroll width equals viewport |
| Landing `src/web` | deployed to app.aevrin.net | PASS | see the `Live` row for landing, dashboard, and deep links |
| Dashboard `src/dash` | `npm run build` (tsc + vite), routes code-split | PASS | 0 TypeScript errors, no chunk-size warning |
| Dashboard `src/dash` | all 16 routes render under `/dashboard/`, incl. 3 detail pages and 404 | PASS | client-side route sweep, 0 console errors |
| Dashboard `src/dash` | light and dark themes match the Catmint reference | PASS | visual comparison in Chrome |
| Dashboard `src/dash` | no horizontal overflow at 390px on every route | PASS | fixed grid min-width blowout and tab bar overflow during the check |
| Dashboard `src/dash` | real control-plane API, auth, multi-tenant isolation | PASS | live mode against the real API and Supabase; isolation checked in the `API src/api` rows; real data checks of analytics are open (#13) |
| CI `deploy-web.yml` / `publish-pypi.yml` | workflow runs on GitHub | PASS | see the `Live` row for CI, site deploy, API deploy, and release workflows |
| API `src/api` | typecheck and Worker bundle (Wrangler 4 dry run) | PASS | 196 KB gzipped; the live deploy is the `API Worker` row |
| API `src/api` | device sign-in: pending, slow_down, approve, token shown once, denial, expiry | PASS | `test/api.test.ts` (in-memory database) |
| API `src/api` | no plaintext device token or device code stored anywhere | PASS | full database scan in the test |
| API `src/api` | device and user credentials rejected on each other's routes | PASS | |
| API `src/api` | sync is idempotent and keeps the user's finding status | PASS | |
| API `src/api` | sync refuses any field outside the contract (payload, response, system prompt, owner, project) | PASS | deliberately loosening the schema makes this test fail |
| API `src/api` | one account cannot read or change another's rows | PASS | deliberately removing the owner filter makes this test fail; Postgres RLS is a second layer not exercised offline |
| API `src/api` | revoked device refused | PASS | |
| Engine 10.4/10.8/10.9 | login, credential storage, client, summarizer, outbox | PASS | 46 tests in `tests/test_cloud_sync.py` (MockTransport) |
| Engine 10.9 | secret planted in payload, response, reasoning, system prompt, URLs, tool args never in the sync body | PASS | with a calibration test that fails a leaky summarizer |
| End to end | real `modelwrecker login` + `sync` against the real API code over local HTTP | PASS | in-memory database; the run's planted secret appeared in 3 local files and 0 cloud responses |
| Live | Supabase migrations applied; 10 tables, RLS on every one; signup trigger present | PASS | checked with SQL after applying, 2026-10-02 |
| Live | landing, dashboard, and dashboard deep links on https://app.aevrin.net | PASS | right page for `/`, `/dashboard/`, `/dashboard/findings`, `/dashboard/campaigns/x`, `/dashboard/connect?code=`; JS, CSS, and images return their real types (an earlier `_redirects` fix returned HTML for them; caught and fixed 2026-10-02); rendered in a clean Chrome profile |
| Live | `modelwrecker 0.0.1` installs from PyPI into a clean environment | PASS | `modelwrecker version` |
| Live | CI, site deploy, API deploy, release workflows on GitHub | PASS | all green on `main` and `v0.0.1` |
| Live | API Worker on `app.aevrin.net/api/*` | PASS | `/api/v1/health` 200; `/api/v1/me` without a token 401 |
| Live | dashboard built in live mode against the real Supabase project | PASS | sign-in screen shown instead of demo data |
| Live | Google sign-in redirect | PASS | "Continue with Google" reaches the Google account screen with the Supabase callback, no `redirect_uri_mismatch` |
| Live | full sign-in, device login, and sync with a real Google account | PASS (maintainer) | the maintainer signed in, approved a device with `modelwrecker login`, and synced (2026-10-02) |
| Live | two campaigns through OpenRouter (targets openai/gpt-4o-mini and meta-llama/llama-3.1-8b-instruct, auto strategies, 5 replays) | PASS | 4 real attempts each, all refused, 0 findings; the API key appears in no run file |
| Engine | `sync` lists pending runs before sending; `sync --dry-run` sends nothing and needs no sign-in | PASS | 3 tests in `tests/test_cloud_sync.py`; live `--dry-run` listed exactly the two OpenRouter runs |
| Live | the two OpenRouter runs synced and shown in the dashboard | PASS (maintainer) | synced by the maintainer; 2 campaigns, 8 attempts, 0 findings in the account |
| Engine | opt-in evidence and transcripts: allowed fields only, never config or endpoint URLs; redacted then capped; size budget; back-fill of runs synced without detail; `--resync`; `--metadata-only`; metadata fallback when settings cannot be read | PASS | 11 tests in `tests/test_cloud_sync.py` (#28) |
| API | detail kept only when the setting is on; shown on finding and campaign routes; metadata-only re-sync keeps it; turning off deletes it; other accounts get 404; strict schema; 4 MB sync cap | PASS | 5 tests in `src/api/test/api.test.ts` (#28) |
| End to end | real `modelwrecker sync` of the 8 real local runs to the real API code (in-memory database) with both settings on | PASS | all 8 back-filled; 4 findings with evidence, 18 attempts in transcripts; second sync sent nothing; turning evidence off removed it; no API key in cloud data |
| Dashboard | transcript card (on and off states), finding evidence view, settings copy | PASS | Chrome, mock mode |
| Live | maintainer's re-sync with detail on | PASS (maintainer) | all 8 runs have transcripts in the account (4 attempts each for the two OpenRouter runs); 4 findings have evidence |
| Engine | `modelwrecker --version`, `-V`, and `version` print the version | PASS | `tests/test_scaffold.py` (#30) |
| Dashboard | leaderboard shows "N of M worked", refusals, small-sample flag, and links to the latest campaign | PASS | API test plus Chrome check in mock mode (#31) |
| Live | larger OpenRouter campaign: 7 strategies x 3 objectives (system prompt, customer PII, staff discount code) against each of openai/gpt-4o-mini and meta-llama/llama-3.1-8b-instruct | PASS | gpt-4o-mini: 0 of 39 attacks worked, 0 findings. Llama 3.1 8B: 12 of 39 worked, 4 findings, including a critical staff-code leak that held on 5 of 5 replays (prompt_extraction); prefill worked 3 of 3 but did not hold on replay, so no finding. Strategies send 1 to 3 attempts per objective, so wider comparisons need more objectives |
| Live | `modelwrecker 0.0.2` from PyPI | PASS | clean Python 3.12 venv: installs, `--version` prints 0.0.2, `sync --help` lists `--dry-run`, `--resync`, `--metadata-only` |
| Live | GitHub history without AI co-author lines; repository Contributors sidebar | PASS | 0 `Co-authored-by` lines on main; contributors API and the page widget list only the maintainer (#4, #34) |
| Live | migration `0003` applied; `finding_evidence` and `run_transcripts` have RLS with owner read and delete policies only | PASS | checked with SQL after applying, 2026-10-02 |
| Dashboard `src/dash` | http mode: config error screen, sign-in gate, PKCE start, Bearer token, 401 signs out | PASS | Chrome, placeholder Supabase URL, no real endpoint called |
| Dashboard `src/dash` | Connect device approval (prefill, approve, deny, reused code) | PASS | mock mode in Chrome |
| Engine | evidence stores the strategy name, not the plan id | PASS | regression test `test_evidence_records_the_strategy_name_not_a_plan_id` |
| API | every paid price keeps a 30-40% margin under the cost model; plans and prices are public | PASS | `src/api/test/billing.test.ts` (#42) |
| API | checkout uses the server price, never the client's; verify needs a valid signature AND Razorpay's captured record; amount mismatch, another account's order, and forged signatures refused; a payment applies once across verify, retries, and webhook; renewals add to the end date; a lapsed plan falls back to Free | PASS | `src/api/test/billing.test.ts` with a fake Razorpay (#12) |
| API | account credit at checkout and full-credit purchases; reconciliation of a paid order nobody reported; webhook signature, duplicate event ids, full refund takes back the time; 503 when billing or the webhook secret is not configured | PASS | `src/api/test/billing.test.ts` (#12) |
| API | device and project limits, Pro-only detail sync and leaderboard | PASS | `src/api/test/billing.test.ts`, `api.test.ts` |
| API | signed entitlement on heartbeat verifies with the public key; an edited payload fails; Pro after payment expires at the paid-until date and includes a bonus; none without a signing key | PASS | `src/api/test/billing.test.ts` (#11) |
| Engine | entitlement verification: valid, edited payload, signature, or header, expired, unknown key, wrong issuer, future-dated; the production key is 32 bytes and not the test key | PASS | `tests/test_entitlements.py` (#11) |
| Engine | free baseline without a token or with a tampered file; MCP targets and explicit PyRIT strategies refused; auto-selected ones skipped; monthly caps from local and signed usage; attempt budget capped and the run counted; `plan` output; `run` refuses before creating a run folder; heartbeat stores only a valid token | PASS | 19 tests in `tests/test_entitlements.py` (#11); merged on `main`, not in a PyPI release yet |
| Live | migration `0004` applied; `payments` and `credit_ledger` owner read only, `billing_events` server only; `fulfil_payment`, `refund_payment`, `adjust_credit` executable by the server key only | PASS | checked with SQL after applying, 2026-10-02 |
| Live | `fulfil_payment` (credit applied, invoice numbered, second call a no-op, 31 days of Pro), `refund_payment` (credit returned) on the real database | PASS | inside a block that always raised, so nothing was kept; invoice counter reset afterwards |
| Live | Razorpay live key accepted (read-only orders listing) | PASS | 2026-10-02 |
| API | staff access: only a verified email exactly on aevrin.net (look-alike domains refused); every admin route needs an admin session; 503 when not configured | PASS | `src/api/test/admin.test.ts` (#43) |
| API | TOTP matches the RFC 6238 test vector; codes cannot be reused; 5 wrong codes lock for 15 minutes; recovery codes work once; secrets stored encrypted with a fresh IV; sessions bound to the staff member, ended after 30 idle minutes, 8 hours, or on request | PASS | `src/api/test/admin.test.ts` (#43) |
| API | plan, bonus, credit, refund, device revoke, sync settings (deletes cloud copies), suspend and restore (user and device routes refused), delete with typed email (payments kept, audit kept, staff refused), reset another admin's authenticator; every change audited with its reason | PASS | `src/api/test/admin.test.ts` (#44) |
| API | page beacon stores a cleaned path, referrer host, country, device, and a daily hash, never the IP or query; Do Not Track, Global Privacy Control, bots, bad bodies, and a missing salt are not counted | PASS | `src/api/test/admin.test.ts` (#45) |
| Dashboard | admin console in mock mode: authenticator setup with a locally drawn QR code, recovery codes, Users, user detail and dialogs, Platform analytics, Page analytics | PASS | Chrome, local stand-in for the Pages worker |
| Live | migration `0005` applied: admin tables and `page_views` have RLS on and no policies; admin functions executable by the server key only; payments keep their rows on user deletion (`ON DELETE SET NULL`); `admin_user_list`, `admin_metrics`, `admin_traffic` return live numbers | PASS | checked with SQL, 2026-10-02 |
| Live | a staff member enrolling an authenticator and using the console | NOT TESTED | needs an @aevrin.net Google account (maintainer) |
| Live | a real purchase, renewal, and refund on the live key | NOT TESTED | needs the maintainer to buy once and refund it from the admin console or Razorpay dashboard |

## Summary

The **local engine** is built and verified offline and live: config, the OpenAI-compatible provider, the
chat, agent, RAG, and simulated MCP targets, the planner, the built-in, PyRIT, and garak strategies, the
multi-signal judge with calibration, reliability replay with Wilson confidence intervals, evidence,
findings with a full attempt transcript, the payload/transform engine, the campaign engine, analytics,
storage, the CLI, and the MCP harness server with its guardrails. Docker builds and runs a full attack
loop as a non-root user. Live OpenRouter runs work, and `modelwrecker` 0.0.2 installs from PyPI.

The **hosted platform** is live at https://app.aevrin.net: landing page, dashboard, control-plane API,
Supabase with RLS, device login, metadata sync, and opt-in evidence and transcript sync. Billing,
signed entitlements, and the admin console are built and tested offline, with their migrations applied
live.

**NOT TESTED** and not claimed as passing: a live MCP-server target (#22), direct OpenAI and Anthropic
adapters (#23), any-llm, a live Ollama run (#24), money budgets (#25), full `replay` (#52), native
Linux/macOS Docker hosts, DNS rebinding (#16), a real purchase on the live key, and a real staff
authenticator enrollment on `/admin`.
