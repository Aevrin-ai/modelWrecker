# Documentation maintenance matrix

Documentation is part of the code. When you make a change, update the matching docs **in the same
task** - not "later". Before you call a non-trivial task done, find your change in the left column
and update everything in the right column.

| Change | Documentation to update |
|--------|-------------------------|
| New CLI command or flag | `docs/reference/CLI.md` |
| New provider / provider adapter | `docs/providers/OVERVIEW.md`; `docs/DEPENDENCIES.md` if a new SDK |
| New attack strategy | `docs/attack-engine/STRATEGIES.md` |
| Change to how the planner picks attacks | `docs/attack-engine/ATTACK-PLANNER.md` |
| New payload transform | `docs/attack-engine/PAYLOAD-ENGINE.md` |
| New target type | `docs/targets/OVERVIEW.md` |
| New judge type or signal | `docs/judges/OVERVIEW.md` |
| Change to reliability/verification | `docs/attack-engine/RELIABILITY.md` |
| Change to evidence or finding shape | `docs/architecture/EVIDENCE-AND-FINDINGS.md`; `docs/architecture/DATA-MODEL.md` |
| New or changed interface/contract | `docs/interfaces/`; `docs/architecture/PLUGIN-SYSTEM.md` |
| Architecture change | `docs/architecture/OVERVIEW.md`; add an ADR in `docs/decisions/` and a row in `DECISIONS.md` |
| Security behavior change | `docs/security/SECURITY.md`; `docs/security/THREAT-MODEL.md` if the threat set changed |
| Local/cloud boundary change | `docs/architecture/local-cloud.md`; add/adjust an ADR and a `DECISIONS.md` row |
| Docker image, mounts, or run shape change | `docs/architecture/docker.md`; `docs/deployment/docker.md`; `docs/security/docker.md` |
| Cloud control plane or data layer change | `docs/architecture/cloud-control-plane.md`; `docs/architecture/data-flow.md`; `docs/deployment/cloudflare.md` |
| Authentication, device, or sync change | `docs/security/authentication.md`; `docs/architecture/data-flow.md` |
| Entitlement or plan change | `docs/security/entitlements.md` (plans are config, not engine code) |
| MCP server tool or guardrail change | `docs/mcp/overview.md`; `docs/mcp/tools.md`; `docs/security/mcp.md` |
| Billing change | `docs/billing/razorpay.md` |
| Dashboard analytics change | `docs/analytics/overview.md` |
| New environment variable | `docs/reference/ENVIRONMENT.md` |
| New config key | `docs/reference/CONFIGURATION.md` |
| New dependency (any) | `docs/DEPENDENCIES.md`; ADR if it is an architectural choice |
| New taxonomy mapping | `docs/architecture/TAXONOMY.md`; `docs/research/taxonomies.md` |
| Any user-visible change | `CHANGELOG.md` (`[Unreleased]`) |
| New major feature | `docs/features/` (+ a row in `docs/features/README.md`); `CHANGELOG.md` |
| Harness/MCP integration change | `docs/features/harness-integration.md` |
| A bug fix that changes expected behavior | the relevant doc; `CHANGELOG.md` |
| Any writing/formatting question | `docs/reference/WRITING-STANDARD.md` |
| New example config | `examples/` (and validate it); mention in `docs/getting-started/yaml.md` |
| Anything tested or newly verified | `docs/testing/test-matrix.md` (honest PASS/FAIL/BLOCKED/NOT TESTED) |
| A test report / run summary | `reports/` |
| Getting-started / tutorial change | `docs/getting-started/` |
| Git, issue, or release process change | `docs/reference/GIT-WORKFLOW.md`; `CLAUDE.md` Git rules |
| A bug found or fixed | a GitHub issue (opened before the fix, closed by the PR); see `docs/reference/GIT-WORKFLOW.md` |

## Before a major phase is "complete"

Do a documentation review (see `CLAUDE.md` → Documentation rules):

- `CLAUDE.md`, `docs/index.md`, architecture docs, security docs, CLI docs, `DEPENDENCIES.md`,
  `DECISIONS.md`, `CHANGELOG.md`, `ROADMAP.md`.
- Remove outdated information, fix broken links, fix broken Mermaid, make examples match the code.
