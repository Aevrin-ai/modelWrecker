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

## Reused behind interfaces (planned; optional or phase-gated)

| Name | Purpose | License | Why | Alternative | Risk | Replace difficulty |
|------|---------|---------|-----|-------------|------|--------------------|
| PyRIT | attack algorithms (PAIR/TAP/Crescendo/...) behind a Strategy adapter; **its memory + scorers are reused** (hybrid) | MIT | mature, Microsoft AI Red Team, active (1.1.0 Sep 2026); avoids re-implementing algorithms, a conversation store, and scorers | implement each strategy + own memory/scorers | medium (deeper coupling; confined to the PyRIT adapter + scorer wrappers) | medium (ADR-0006) |
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
