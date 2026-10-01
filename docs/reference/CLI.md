# CLI reference

**Status: proposed.** The CLI is Typer-based. Command names may change after Phase 4. This
is the source of truth for the CLI; update it with every command/flag change.

Binary: `modelwrecker` (the engine). An Aevrin-branded wrapper may alias these later.

## Commands

```bash
modelwrecker run       target.yaml      # run all objectives in a config against a target
modelwrecker attack    target.yaml      # run a single objective/strategy (quick, interactive)
modelwrecker campaign  campaign.yaml    # run a multi-objective campaign
modelwrecker replay    evidence.json    # reproduce a finding from its evidence
modelwrecker report    run.json         # render a report from a run (md/html/json/sarif)
modelwrecker validate  finding.json     # re-run reliability on a finding
modelwrecker check                      # validate config: providers, keys, target, judge, egress
modelwrecker providers list             # show configured providers and health
modelwrecker strategies list           # show registered strategies + required capabilities
```

## Modes

| Flag | Meaning |
|------|---------|
| (default) | interactive |
| `--auto "<objective>"` | autonomous one-shot run |
| `--headless` | no prompts, machine output |
| `--ci` | headless + non-zero exit on findings |
| `--output {json,sarif,md,html}` | output format |
| `--fail-on-finding` | exit non-zero if any finding (CI gate) |

## Common options

| Option | Meaning |
|--------|---------|
| `--attacker / --target / --judge <endpoint>` | override role endpoints |
| `--max-rounds N` · `--budget-tokens N` · `--timeout S` | limits |
| `--strategy <name>` | force a strategy (else planner chooses) |
| `--replays N` | reliability replay count |
| `--allow-host-tools` | explicit opt-in to host-affecting tools (off by default) |
| `--authorized "<text>"` | record asserted authorization in run metadata |
| `--out <path>` | artifact output location |

## Safety behavior

- No command opens a network listener. (A future `api` command would require an auth token and refuse
  non-loopback binds without auth - see [`../security/SECURITY.md`](../security/SECURITY.md).)
- `--allow-host-tools` is the only way to enable shell/file-write/arbitrary-HTTP tools, and it is never
  implied.
- `check` validates the egress guard and that secrets resolve from env, not from tracked config.

## Examples

```bash
# Fully local run against an Ollama model, report to HTML
modelwrecker run target.yaml --attacker ollama/llama3 --target ollama/llama3 \
  --judge ollama/llama3 --output html --out report.html

# CI gate on a hosted target
modelwrecker campaign campaign.yaml --ci --fail-on-finding --output sarif --out findings.sarif
```
