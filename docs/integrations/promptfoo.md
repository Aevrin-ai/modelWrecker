# Using a Promptfoo config with modelWrecker

> Read [`../research/promptfoo-integration.md`](../research/promptfoo-integration.md) for why the
> integration works this way, and [`../decisions/ADR-0022-promptfoo-translator.md`](../decisions/ADR-0022-promptfoo-translator.md)
> for the decision.

[Promptfoo](https://github.com/promptfoo/promptfoo) is an MIT-licensed LLM eval and red-team tool. It
is a Node application, and its most useful agent, MCP, and RAG red-team plugins run only through its
hosted service (`api.promptfoo.app`). modelWrecker is local-first and must stay fully usable offline,
so it does **not** run or bundle Promptfoo.

What modelWrecker gives you instead is a one-way **config translator**: it reads the `redteam` section
of a Promptfoo config and writes a modelWrecker config. You then run that config on modelWrecker's own
engine, which keeps its planner, multi-signal judge, reliability replay, budgets, evidence, and
authorization. The agent-security tests that Promptfoo can only run remotely (indirect prompt
injection, MCP tool poisoning, RAG injection, memory poisoning) modelWrecker runs locally.

```mermaid
flowchart LR
  A[Promptfoo redteam YAML] --> B[translator]
  B --> C[modelWrecker config]
  C --> D[modelWrecker engine]
```

## How to use it

```bash
modelwrecker import-promptfoo promptfooconfig.yaml -o my.yaml
# review my.yaml (attacker and judge default to the target), then:
modelwrecker run my.yaml
```

The translator maps the Promptfoo target to a modelWrecker target, each Promptfoo plugin to a
modelWrecker objective, and the Promptfoo strategies to one modelWrecker strategy (or a payload
transform). The attacker and judge endpoints default to the target; edit them before running.

## What it will not do

It never silently drops or approximates an unsupported id. A plugin or strategy that is remote-only in
Promptfoo, deprecated, or has no modelWrecker equivalent stops the translation with a clear error that
names the id and the reason. Fix the config (remove the id, or pick a supported one) and run again.
This keeps results honest: a remote-only Promptfoo plugin is reported as not supported, not as a
target that passed.

## Supported plugins

Each Promptfoo plugin becomes a modelWrecker objective in the category shown. The planner then picks
the strategy for that category.

| Promptfoo plugin | modelWrecker objective category |
| --- | --- |
| `prompt-extraction` | system prompt leak |
| `pii`, `pii:direct` | PII leak |
| `harmful`, `harmful:cybercrime` | harmful (generated locally, not by Promptfoo's hosted model) |
| `indirect-prompt-injection` | indirect injection (native, local) |
| `mcp` | MCP tool poisoning (native, local) |
| `excessive-agency`, `rbac`, `bola`, `bfla` | excessive agency / tool misuse |
| `rag-poisoning` | RAG injection (native, local) |
| `rag-document-exfiltration` | data exfiltration |
| `cross-session-leak` | memory poisoning |

## Supported strategies

Only one strategy runs per modelWrecker objective, so the first supported strategy is used.

| Promptfoo strategy | modelWrecker |
| --- | --- |
| `basic`, `default` | `direct_jailbreak` |
| `jailbreak`, `best-of-n` | `best_of_n` (a local iterative substitute, not Promptfoo's algorithm) |
| `crescendo` | `crescendo` |
| `base64`, `rot13`, `leetspeak`, `homoglyph` | `encoded_jailbreak` with that payload transform |
| `indirect-prompt-injection` | `indirect_prompt_injection` |

## Not supported (the translator errors)

- Remote-only Promptfoo strategies: `goat`, `jailbreak:hydra`, `jailbreak:meta`, `jailbreak:goblin`,
  `jailbreak:composite`, `jailbreak:likert`, `citation`, `gcg`, `indirect-web-pwn`, `audio`, `video`.
- Deprecated Promptfoo strategies: `prompt-injection`, `multilingual`.
- Out-of-scope or remote-only plugins: `hijacking`, `ascii-smuggling`, and the brand-safety plugins
  (`competitors`, `politics`, `religion`, `imitation`). Any id not in the tables above is rejected as
  unknown.

See [`../research/promptfoo-integration.md`](../research/promptfoo-integration.md) for the full
upstream inventory and the local-vs-remote status of every plugin and strategy.
