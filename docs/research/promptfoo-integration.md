# Promptfoo integration research

A source-level review of [Promptfoo](https://github.com/promptfoo/promptfoo) done to plan a
local-first integration into modelWrecker. It reflects the upstream source at `main` (npm 0.124.1) as
read on 2026-10-11. The decision is recorded in
[`../decisions/ADR-0022-promptfoo-translator.md`](../decisions/ADR-0022-promptfoo-translator.md); the
supported subset is in [`../integrations/promptfoo.md`](../integrations/promptfoo.md).

## 1. License and packaging

- **License: MIT** (root `LICENSE`, "Copyright (c) Promptfoo 2025"). Permissive and Apache-2.0
  compatible, so copying would be legal. That is not the blocker; the runtime and remote coupling are.
- **npm `promptfoo` 0.124.1** (2026-10-08), `license: MIT`, `engines.node >=22.22.0`. A heavy runtime
  floor for a Python-first project.
- **PyPI `promptfoo` 0.2.0** is only a shim: it checks for Node and runs `npx promptfoo@latest`, passing
  through args and env. It is not a Python library and it reaches the network.
- Not verified: whether any subfolder carries a divergent license header (grep before vendoring). We do
  not vendor, so this does not apply.

## 2. Architecture

Promptfoo separates four concerns (https://www.promptfoo.dev/docs/red-team/architecture/):
**plugins** generate adversarial inputs for a vulnerability type, **strategies** control how those
inputs are delivered (encodings, multi-turn, iterative), **targets** are the systems under test, and an
**evaluation engine** grades responses. This maps onto modelWrecker's strategy / target / judge split.
The key coupling: Promptfoo generates attacks remotely by default.

## 3. Plugins (from `src/redteam/constants/plugins.ts`)

Collections include BASE (contracts, excessive-agency, hallucination, hijacking, politics), PII
(pii:api-db, pii:direct, pii:session, pii:social), the full `harmful:*` family, MCP (mcp, pii, bfla,
bola, sql-injection, rbac), AGENTIC (agentic:memory-poisoning), and a large ADDITIONAL set
(indirect-prompt-injection, rag-poisoning, rag-document-exfiltration, tool-discovery,
cross-session-leak, debug-access, shell-injection, sql-injection, ssrf, prompt-extraction, and more),
plus vertical packs (medical, financial, and so on).

**REMOTE_ONLY_PLUGIN_IDS** (no local implementation; always call `api.promptfoo.app`):
`agentic:memory-poisoning`, coding-agent collections, `ascii-smuggling`, `bfla`, `bola`, `cca`,
`competitors`, `coppa`, `data-exfil`, `ferpa`, `goal-misalignment`,
`harmful:misinformation-disinformation`, `harmful:specialized-advice`, `hijacking`,
`indirect-prompt-injection`, `mcp`, `model-identification`, `off-topic`, `rag-document-exfiltration`,
`rag-poisoning`, `rag-source-attribution`, `reasoning-dos`, `religion`, `special-token-injection`,
`ssrf`, `system-prompt-override`, `wordplay`, and the vertical packs.

Important point: the agent-security plugins modelWrecker cares about most
(indirect-prompt-injection, mcp, rag-poisoning, bola, bfla, ssrf) are exactly the ones that are
remote-only in Promptfoo. modelWrecker runs these locally, which is a genuine advantage to keep.

Local plugins we can map cleanly: prompt-extraction, pii:*, rbac, excessive-agency, tool-discovery,
cross-session-leak, debug-access, shell-injection, sql-injection, and the harmful family (we generate
the harmful objective ourselves rather than reusing Promptfoo's hosted unaligned model).

## 4. Strategies (from `src/redteam/constants/strategies.ts`)

Static encodings (local, pure functions): base64, rot13, leetspeak, homoglyph, hex, morse, and the
`other-encodings` set. Confirmed by reading `src/redteam/strategies/base64.ts`: the transform is a pure
local function (`Buffer.from(text).toString('base64')`), no network. Baseline: `basic`. Multi-turn and
iterative that need an attacker model (not the hosted service): crescendo, jailbreak, jailbreak:tree,
mischievous-user.

**STRATEGIES_REQUIRING_REMOTE** (disabled when `PROMPTFOO_DISABLE_REMOTE_GENERATION` is set): `audio`,
`citation`, `gcg`, `goat`, `indirect-web-pwn`, `jailbreak:composite`, `jailbreak:goblin`,
`jailbreak:hydra`, `jailbreak:likert`, `jailbreak:meta`.

## 5. Offline reality

- `PROMPTFOO_DISABLE_REMOTE_GENERATION=true` disables remote generation fallbacks but, per the
  data-handling docs, "does not disable telemetry, account/license checks, sharing, Cloud sync" and is
  "not a network isolation guarantee". `PROMPTFOO_DISABLE_TELEMETRY=1` turns off usage telemetry.
- With remote generation disabled you can still run: the static encodings, `basic`, the iterative
  strategies that use your own attacker model, and the local plugins listed above. You lose everything
  in REMOTE_ONLY_PLUGIN_IDS, the unaligned harmful and bias plugins, and STRATEGIES_REQUIRING_REMOTE.

## 6. MCP provider

Promptfoo's `providers: [{id: mcp, config: {server: ...}}]` calls MCP tools directly to test an MCP
server (stdio via `command`/`args`, or URL/HTTP). Prompt shape is `{"tool": name, "args": {...}}`. This
matches modelWrecker's `target.type: mcp`, so an `mcp` provider maps to our MCP target.

## 7. Red team config schema

Under `redteam:`: `plugins`, `strategies`, `purpose`, `numTests`, `provider`, `injectVar`, and more. A
plugin entry is a string id or `{id, numTests?, severity?, config?}`; a strategy entry is a string id or
`{id, config?}`. Targets are under `targets:`/`providers:`.

## Decision for modelWrecker

Do not embed, vendor, or shell out to Promptfoo. Build a one-way Python config translator (Promptfoo
`redteam` YAML in, modelWrecker config out) and re-express the static encodings with our own payload
transforms (we already have base64, rot13, leetspeak, homoglyph). Reject remote-only, deprecated, and
no-equivalent ids with a clear error that names them, so a not-supported Promptfoo test never shows up
as a false pass. modelWrecker keeps the whole engine (planner, strategy loop, judge, reliability,
evidence, campaign, budgets, authorization) and its native agent attacks. See ADR-0022.

The exact plugin and strategy ids that the translator supports, and the ones it rejects, are listed in
[`../integrations/promptfoo.md`](../integrations/promptfoo.md). The mapping is intentionally a subset:
it favours ids with an honest, offline-available modelWrecker equivalent.

## Sources opened

Promptfoo `LICENSE`, `package.json`, `src/redteam/constants/plugins.ts`,
`src/redteam/constants/strategies.ts`, `src/redteam/strategies/base64.ts`; the npm and PyPI registry
JSON; promptfoo-python README; and the docs pages for red-team architecture, strategies, plugins,
configuration, the MCP provider, data handling, inference limits, and telemetry. Context7
(`/promptfoo/promptfoo`) corroborated the data-handling page.

## Caveats

- The REMOTE_ONLY set is read from the constants file and is authoritative; the "unaligned harmful needs
  remote generation" distinction comes from the docs, not from reading each plugin class.
- `CODING_AGENT_PLUGINS` members (part of the remote-only spread) were not opened.
- Versions are from the registry; not cross-checked against a GitHub release page.
