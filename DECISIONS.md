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
| 0014 | Local and cloud boundary: heavy red-team compute runs locally in Docker; the Aevrin cloud is a thin control plane only, never a hidden compute dependency | Accepted | [ADR-0014](docs/decisions/ADR-0014-local-cloud-boundary.md) |
| 0015 | Cloud data layer: Supabase Postgres + row-level security, Cloudflare Pages for static hosting, Cloudflare Workers for thin API glue | Accepted | [ADR-0015](docs/decisions/ADR-0015-data-layer.md) |
| 0016 | Billing provider is Razorpay, cloud-only; payment confirmed by a server-verified webhook; no Razorpay secret in Docker/MCP/CLI/engine | Accepted | [ADR-0016](docs/decisions/ADR-0016-billing-razorpay.md) |
| 0017 | Device credential model: each install gets a scoped, revocable device/project token, never the user's Google token | Accepted | [ADR-0017](docs/decisions/ADR-0017-device-credential-model.md) |
| 0018 | Entitlement enforcement: cloud issues a signed scoped entitlement the local engine verifies; enforced outside the UI; no pricing logic in the engine | Accepted | [ADR-0018](docs/decisions/ADR-0018-entitlement-enforcement.md) |
| 0019 | Prepaid plans (month or year) through Razorpay Orders; a payment is applied once, on the server, from verify (signature plus Razorpay fetch), webhook, or reconciliation | Accepted | [ADR-0019](docs/decisions/ADR-0019-prepaid-billing.md) |

## Resolved maintainer decisions

Confirmed by the maintainer on 2026-10-01:

- **Default multi-provider adapter:** adopt **any-llm** as the default multiplexer behind the Provider
  interface; direct SDK + OpenAI-compatible adapters remain first-class fallbacks. (ADR-0003)
- **PyRIT depth:** **thin adapter + reuse PyRIT memory and scoring** (hybrid). (ADR-0006)
- **Target order:** chat API first, then **agent, RAG, and MCP** targets. (ROADMAP, `docs/targets/OVERVIEW.md`)
- **Harness integration** is in scope as a first-class feature. (ADR-0013, `docs/features/harness-integration.md`)

Confirmed by the maintainer on 2026-10-02:

- **Cloud data layer:** Supabase Postgres + row-level security, Cloudflare Pages for hosting, Cloudflare
  Workers only for thin API glue (not all-Cloudflare D1). (ADR-0015)
- **Live cloud setup is staged, not automated:** DNS, schema apply, OAuth client, and the first PyPI publish
  are run by the maintainer from `deploy/`. (ROADMAP Phase 10)
- **Web app locations:** landing page in `src/web`, dashboard in `src/dash`, one Cloudflare Pages project
  (landing at `/`, dashboard at `/dashboard/`), redeployed by CI on changes to either folder.

Recorded on 2026-10-02 (engineering decision, ADR-0013 update): MCP targets come only from config (there
is no `define_target` tool), and every MCP run is capped by `McpLimits`.

Confirmed by the maintainer on 2026-10-02 (issues #11, #12, #42):

- **Local engine without a signed entitlement runs the free baseline**: core strategies, any model, Free
  monthly limits. PyRIT, garak, and MCP targets need a signed Pro entitlement. (ADR-0018)
- **Billing is prepaid** by the month or the year through Razorpay Orders, with no automatic renewal.
  (ADR-0019)
- **Prices include 18% GST** and keep a 30 to 40 percent margin under the cost model in
  `docs/billing/pricing.md`.

No open decisions remain.
