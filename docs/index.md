# Documentation map

This is the map of modelWrecker's documentation. It answers: *what is this document, why does it
exist, and which one do I read next?* Keep it updated whenever a doc is added or moved.

## Start here

- [`../CLAUDE.md`](../CLAUDE.md) - the rules and the reading order. Read first, every time.
- [`architecture/OVERVIEW.md`](architecture/OVERVIEW.md) - how the whole system fits together.
  **Read this second.**

## New user? (getting started)

- [`getting-started/first-campaign.md`](getting-started/first-campaign.md) - run your first campaign, step by step.
- [`getting-started/yaml.md`](getting-started/yaml.md) - how the YAML config works, field by field.
- [`testing/test-matrix.md`](testing/test-matrix.md) - what has actually been tested (honest status).

## If you are working on…

| Area | Read |
|------|------|
| The big picture / data flow | [`architecture/OVERVIEW.md`](architecture/OVERVIEW.md) |
| How attacks are chosen and run | [`attack-engine/OVERVIEW.md`](attack-engine/OVERVIEW.md), [`attack-engine/ATTACK-PLANNER.md`](attack-engine/ATTACK-PLANNER.md), [`attack-engine/STRATEGIES.md`](attack-engine/STRATEGIES.md) |
| Turning a success into a finding | [`attack-engine/RELIABILITY.md`](attack-engine/RELIABILITY.md), [`architecture/EVIDENCE-AND-FINDINGS.md`](architecture/EVIDENCE-AND-FINDINGS.md) |
| Talking to models | [`providers/OVERVIEW.md`](providers/OVERVIEW.md) |
| Attacking a specific kind of system | [`targets/OVERVIEW.md`](targets/OVERVIEW.md) |
| Deciding if an attack worked | [`judges/OVERVIEW.md`](judges/OVERVIEW.md) |
| Transforming/encoding payloads | [`attack-engine/PAYLOAD-ENGINE.md`](attack-engine/PAYLOAD-ENGINE.md) |
| Running many objectives at once | [`campaigns/OVERVIEW.md`](campaigns/OVERVIEW.md) |
| ASR analytics, leaderboards, reports | [`attack-engine/ANALYTICS.md`](attack-engine/ANALYTICS.md) |
| Local-first product: local vs cloud | [`architecture/local-cloud.md`](architecture/local-cloud.md), [`architecture/cloud-control-plane.md`](architecture/cloud-control-plane.md), [`architecture/data-flow.md`](architecture/data-flow.md) |
| Running the engine in Docker | [`architecture/docker.md`](architecture/docker.md), [`deployment/docker.md`](deployment/docker.md), [`security/docker.md`](security/docker.md) |
| The control-plane API (routes, device sign-in, sync) | [`architecture/control-plane-api.md`](architecture/control-plane-api.md) |
| Hosting the cloud control plane | [`deployment/cloudflare.md`](deployment/cloudflare.md) |
| Sign-in, devices, entitlements | [`security/authentication.md`](security/authentication.md), [`security/entitlements.md`](security/entitlements.md) |
| Driving modelWrecker over MCP | [`mcp/overview.md`](mcp/overview.md), [`mcp/tools.md`](mcp/tools.md), [`security/mcp.md`](security/mcp.md) |
| Billing | [`billing/razorpay.md`](billing/razorpay.md) |
| The cloud dashboard and analytics | [`analytics/overview.md`](analytics/overview.md) |
| Security / what we must never do | [`security/SECURITY.md`](security/SECURITY.md), [`security/THREAT-MODEL.md`](security/THREAT-MODEL.md) |
| The CLI | [`reference/CLI.md`](reference/CLI.md) |
| Configuration and env vars | [`reference/CONFIGURATION.md`](reference/CONFIGURATION.md), [`reference/ENVIRONMENT.md`](reference/ENVIRONMENT.md) |
| The data shapes everything passes around | [`architecture/DATA-MODEL.md`](architecture/DATA-MODEL.md) |
| The interfaces (the contracts) | [`interfaces/README.md`](interfaces/README.md) |
| Adding a plugin | [`architecture/PLUGIN-SYSTEM.md`](architecture/PLUGIN-SYSTEM.md) |
| Which taxonomy a finding maps to | [`research/taxonomies.md`](research/taxonomies.md), [`architecture/TAXONOMY.md`](architecture/TAXONOMY.md) |
| Driving modelWrecker from Claude Code / Codex | [`features/harness-integration.md`](features/harness-integration.md) |
| How to write docs for this project | [`reference/WRITING-STANDARD.md`](reference/WRITING-STANDARD.md) |

## Reference & process

- [`reference/WRITING-STANDARD.md`](reference/WRITING-STANDARD.md) - how we write everything here.
- [`DOCUMENTATION.md`](DOCUMENTATION.md) - the change→doc table. Check it before finishing a task.
- [`DEPENDENCIES.md`](DEPENDENCIES.md) - every external dependency and why we keep it.
- [`features/`](features/README.md) - cross-cutting user-facing features.
- [`decisions/`](decisions/) - the ADRs (architecture decision records).
- [`../ROADMAP.md`](../ROADMAP.md) · [`../CHANGELOG.md`](../CHANGELOG.md) · [`../DECISIONS.md`](../DECISIONS.md)

## Research (Phase 0 background)

- [`research/aevrin.md`](research/aevrin.md) - what Aevrin is and how modelWrecker fits it.
- [`research/design-lessons.md`](research/design-lessons.md) - the design patterns modelWrecker adopts
  from Aevrin's security research.
- [`research/oss-landscape.md`](research/oss-landscape.md) - PyRIT, garak, promptfoo, DeepTeam,
  provider gateways; what to reuse and what to build.
- [`research/taxonomies.md`](research/taxonomies.md) - the security taxonomies we map findings to.