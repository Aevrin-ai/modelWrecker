# Dependencies

Every external dependency and why we keep it. Add a row before adding a dependency (`CLAUDE.md` rule).
Prefer MIT/Apache-2.0/BSD. The system must stay fully usable with free, self-hostable parts only - no
mandatory paid SaaS, no enterprise-only feature in the critical path. The survey behind these
choices is [`research/oss-landscape.md`](research/oss-landscape.md).

Status/versions verified 2026-10-01; re-check before adopting.

## Core (planned, in the critical path)

| Name | Purpose | License | Why | Alternative | Risk | Replace difficulty |
|------|---------|---------|-----|-------------|------|--------------------|
| Python 3.12+ | language/runtime | PSF | ecosystem fit (all tools below are Python) | - | low | n/a (ADR-0001) |
| httpx | async HTTP core | BSD | standard, async, used by SDKs | aiohttp | low | easy |
| pydantic v2 | data models/validation | MIT | our data model + config | attrs+manual | low | medium |
| PyYAML | config files | MIT | config loading | tomllib (stdlib) | low | easy |
| Typer (+Click) | CLI | MIT/BSD | clean CLI, declarative | argparse | low | easy |
| openai (SDK) | OpenAI + OpenAI-compatible adapter | Apache-2.0 | official, stable | raw httpx | low | easy |
| anthropic (SDK) | Anthropic adapter | MIT | official, stable | raw httpx | low | easy |
| Jinja2 | HTML report rendering | BSD | templating | f-strings | low | easy |
| cryptography | Ed25519 verification of the signed entitlement (issue #11) | Apache-2.0 / BSD-3-Clause | the standard, audited Python crypto library; already pulled in by PyRIT's dependencies | PyNaCl | low | easy |

## Reused behind interfaces (planned; optional or phase-gated)

| Name | Purpose | License | Why | Alternative | Risk | Replace difficulty |
|------|---------|---------|-----|-------------|------|--------------------|
| PyRIT 1.1 | PAIR/TAP attacks + converters behind our Strategy/Transform interfaces | MIT | mature, Microsoft AI Red Team; avoids re-implementing algorithms/converters | implement each strategy | **Integrated** in the project `.venv` (`attacks` extra); PAIR runs offline to SUCCESS. Keep behind the bridge so churn is contained | medium (ADR-0006) |
| any-llm (`any-llm-sdk`) | **default** multi-provider multiplexer behind our Provider interface | Apache-2.0 | library (no proxy), Mozilla.ai, active (1.25.0 Aug 2026); broad coverage, self-hostable | direct SDKs only | medium: relatively new; kept behind our interface so it is swappable | medium (ADR-0003) |
| garak | batch probe/detector scanning (Phase 8) | Apache-2.0 | NVIDIA, active (0.17.0 Sep 2026); broad probe set | first-party probes | low-medium | medium |
| mcp (Python SDK v2) | MCP client/server for MCP targets & attack delivery | MIT | official, supports 2026-07-28 spec | raw protocol | low | hard |
| presidio-analyzer | PII detection judge signal | MIT | mature, Microsoft | regex sets | low | easy |
| detect-secrets | secret-leak judge signal | Apache-2.0 | mature, Yelp | gitleaks / regex | low | easy |
| Hypothesis | property-based tests | MPL-2.0 | edge-case coverage for guard/transforms | hand-written cases | low | easy |

## Optional provider adapters (never required)

(any-llm is listed above as a core dependency because it is the default multiplexer.)

| Name | Purpose | License | Why optional | Risk |
|------|---------|---------|--------------|------|
| litellm | multiplexer adapter | MIT core (enterprise/ dir separate) | some teams standardize on it | **high**: enterprise split + Mar-2026 supply-chain incident → optional only, pin via Docker |
| Portkey gateway | external gateway adapter | MIT | teams already running it | medium: TS service, not a Python lib fit |

## Web apps and cloud control plane (TypeScript, Phase 10)

These live in `src/web` (landing), `src/dash` (dashboard), and `src/api` (control-plane Worker). None of
them is in the engine's path: the local engine runs fully without the cloud, so the "free and
self-hostable" rule holds for red teaming itself. Versions are pinned by each app's `package-lock.json`.

| Name | Used in | Purpose | License | Why | Alternative | Risk | Replace difficulty |
|------|---------|---------|---------|-----|-------------|------|--------------------|
| React 18, Vite, TypeScript | web, dash | UI and build | MIT / Apache-2.0 | standard, fast static builds for Cloudflare Pages | Svelte, plain HTML | low | hard (UI rewrite) |
| Tailwind CSS (v4 web, v3 dash) | web, dash | styling with design tokens | MIT | tokens map 1:1 to the measured reference styles | CSS modules | low | medium |
| motion | web | entrance and scroll animation | MIT | small, respects reduced motion | CSS only | low | easy |
| lucide-react | web, dash | icons | ISC | tree-shaken icons | heroicons | low | easy |
| react-router-dom | dash | routing under `/dashboard/` | MIT | standard | TanStack Router | low | medium |
| Recharts | dash | charts (code-split per page) | MIT | simple, themeable | visx, hand SVG | low | medium |
| zod | dash, api | schema validation | MIT | strict request schemas reject unknown fields | valibot | low | easy |
| clsx, tailwind-merge | dash | class name helpers | MIT | tiny | hand-rolled | low | easy |
| @supabase/supabase-js | dash, api | Google sign-in (dash); token verification and RLS-scoped queries (api) | MIT | official client; RLS applies when queries carry the user's token | raw PostgREST + GoTrue over fetch | low | medium |
| Hono | api | request routing on Cloudflare Workers | MIT | tiny, built for Workers, testable with `app.request` | hand-written router | low | easy |
| Wrangler | api | build, local dev, deploy of the Worker | MIT / Apache-2.0 | official Cloudflare CLI | Cloudflare dashboard upload | low | easy |
| vitest, @cloudflare/workers-types | api | tests, Worker types | MIT / Apache-2.0 | offline tests against an in-memory database | jest | low | easy |
| qrcode | dash (admin only) | draws the authenticator enrollment QR code in the browser, so the secret never goes to a third-party QR service | MIT | small, widely used, no network calls | show the setup key as text only | low | easy |

Razorpay Checkout (`checkout.razorpay.com/v1/checkout.js`) is loaded by the dashboard's Billing page only
when the user clicks Buy. It is Razorpay's hosted payment form, not a package; card and UPI details are
entered there and never reach Aevrin. The API talks to Razorpay's REST API with `fetch` (no SDK).

Platform services (not packages): Supabase (managed Postgres + Auth, Apache-2.0 open source and
self-hostable), Cloudflare Pages and Workers (free tiers, see `deployment/cloudflare.md`), Google OAuth.
Decision record: ADR-0015.

## Explicitly NOT used

| Rejected | Why |
|----------|-----|
| AGPL-licensed red-team code | AGPL-3.0, incompatible with our Apache-2.0; not reused (ADR-0002) |
| plinius corpora (P4RS3LT0NGV3/L1B3RT4S/ENI) + Node bridge | messy licensing, Node dependency, maintenance liability; first-party transforms instead (ADR-0009) |
| custom checksum/corpus-integrity subsystem | forbidden by our rules; `uv.lock` is enough (ADR-0010) |
| LiteLLM Enterprise / Promptfoo Cloud / any proprietary gateway in the critical path | must stay free + self-hostable |

## Dependency budget

Keep the core small. For each dependency ask: *would removing this meaningfully improve maintenance
without losing important function?* If yes, drop it. Trivial functionality uses the stdlib. Vendor code
is confined to adapter modules so any one dependency is cheap to replace.
