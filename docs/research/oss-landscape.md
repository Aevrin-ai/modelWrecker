# Research: open-source landscape

*Phase 0 note. Captured 2026-10-01 from PyPI, GitHub, and project sites. Versions/dates are current
as of that day; re-check before adopting (see `CLAUDE.md` → Dependency rules).*

The rule: don't rebuild mature, free, maintained OSS - but don't add a dependency
just because it exists. For each subsystem we ask: does a clean, permissive, maintained project
solve this well enough to sit behind our interface? The per-dependency decision table lives in
[`../DEPENDENCIES.md`](../DEPENDENCIES.md); this note is the survey behind it.

## Red-teaming frameworks

| Project | Owner | License | Latest (2026-10-01) | What it gives us | Verdict |
|---------|-------|---------|---------------------|------------------|---------|
| **PyRIT** | Microsoft AI Red Team | MIT | 1.1.0 (Sep 4 2026) | Orchestrators for PAIR/TAP/Crescendo/skeleton-key, converters, scorers, memory, targets | **Reuse behind an adapter** for attack algorithms. Mature, permissive, actively released. See ADR-0006. |
| **garak** | NVIDIA | Apache-2.0 | 0.17.0 (Sep 9 2026) | A library of probes + detectors for batch vulnerability scanning (encoding, gcg, glitch, atkgen, …) | **Reuse behind an adapter** as a batch-scan strategy source (Phase 8). Permissive, active. |
| **promptfoo** | OpenAI (acq. Mar 2026) | MIT | active | Declarative evals + red-team plugins; strong RAG/agentic plugin set | Study its config ergonomics and plugin taxonomy. Node-first; **do not** make it a core dependency. Still MIT + self-hostable. |
| **DeepTeam** | Confident AI | open source (on DeepEval) | active | Vulnerability + attack catalog, maps to OWASP/NIST/MITRE | Reference for taxonomy mapping and vulnerability catalog design. Optional later. |

Takeaway: the attack *algorithms* are solved by PyRIT and garak. We do **not** re-implement PAIR,
TAP, Crescendo, GCG, etc. from scratch. We own the **planner** that decides which to run and when,
the **adaptive loop**, and the **verification/evidence** layer - the parts these libraries don't
give us as a product.

## Provider gateways / abstractions

| Project | License | Latest | Notes | Verdict |
|---------|---------|--------|-------|---------|
| **LiteLLM** | MIT core; `enterprise/` dir is separately licensed | 1.83.0 (post-incident) | 140+ providers; **supply-chain incident Mar 24 2026** (malicious PyPI 1.82.7/1.82.8 stole credentials via a `.pth` auto-exec). Enterprise/OSS split. | **Optional adapter only.** Never a hard dependency; never in the critical path. If used, pin via Docker/lockfile. See ADR-0003. |
| **Portkey Gateway** | MIT | Gateway 2.0 pre-release (enterprise merging into OSS) | TypeScript gateway, 1600+ models, guardrails | **Optional external adapter** for teams already running it. Not a Python-library fit for our core. |
| **any-llm** (`any-llm-sdk`) | Apache-2.0 | 1.25.0 (Aug 11 2026) | Mozilla.ai; unified Python interface over OpenAI/Anthropic/Azure/Mistral/Ollama/…; **library, not a proxy**; Trusted-Publishing on PyPI | **Strong candidate** as the default multiplexer behind our Provider interface - avoids rebuilding wire protocols without a hosted proxy. Decision open (ADR-0003). |
| Direct SDKs (`openai`, `anthropic`) | Apache-2.0 / MIT | current | Official, stable, well-documented | **Always available** as first-class adapters; the fallback that needs no gateway at all. |

Lesson from the LiteLLM incident: a gateway library sits on *every* provider credential, which makes
it a high-value supply-chain target. Our provider layer stays thin and swappable, treats any gateway
as optional, and keeps direct-SDK + OpenAI-compatible adapters as the always-works baseline.

## Supporting subsystems (reuse, don't build)

| Need | Project | License | Verdict |
|------|---------|---------|---------|
| MCP client/server (attack & target MCP) | **MCP Python SDK** (`mcp`) v2.x | MIT | Reuse. Official, supports the 2026-07-28 spec. |
| PII detection in the judge | **Microsoft Presidio** | MIT | Reuse behind the judge's PII signal. |
| Secret detection in the judge | **detect-secrets** (Yelp) / **gitleaks** | Apache-2.0 / MIT | Reuse for the secret-leak signal. |
| CLI framework | **Typer** / **Click** | MIT / BSD | Reuse. |
| Config + schemas | **Pydantic v2** + PyYAML | MIT | Reuse. |
| HTTP core | **httpx** | BSD | Reuse. |
| Report output | **Jinja2** (HTML), stdlib json, a small SARIF writer | BSD | Reuse Jinja2; SARIF schema is a small first-party writer. |
| Datasets | HarmBench / AdvBench / JBB / StrongREJECT loaders | per-dataset | Thin loaders; respect each dataset's license; gitignore cached copies. |

## What we build ourselves (the core IP)

Attack Planner · Strategy interface + adaptive attack loop · Target abstraction · Judge ensemble +
verdict combiner · Reliability/verification · Evidence system · Finding engine · Campaign engine ·
the thin Provider interface · the first-party payload/transform set · taxonomy mapping. These are the
parts that make modelWrecker a product rather than a wrapper, and the parts the OSS projects above do
not hand us cleanly. See [`../architecture/OVERVIEW.md`](../architecture/OVERVIEW.md).
