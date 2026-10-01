# CLI reference

The CLI is Typer-based. This is the source of truth for the CLI; update it with every command/flag
change. Binary: `modelwrecker`.

## Implemented today (Phase 4)

```bash
modelwrecker init       my.yaml                    # write a starter config to edit
modelwrecker validate   my.yaml                    # validate a config (schema, protocols, authorization, objectives)
modelwrecker check      my.yaml                    # validate + show which API keys resolve from the environment
modelwrecker provider test my.yaml --role target   # one small live request: latency, tokens, errors
modelwrecker run        my.yaml  --output md|json  # run all objectives, verify, write a report
modelwrecker report     runs/<run-id>              # re-render a finished run's findings (markdown)
modelwrecker replay     evidence.json              # reproduce a finding from its evidence
modelwrecker strategies                            # list registered strategies + required capabilities
modelwrecker mcp        --runs-dir runs            # start the harness MCP server over stdio (ADR-0013)
modelwrecker version
```

`run` options: `--output md|json` (default `md`), `--out-dir runs` (where artifacts go).
`provider test` option: `--role attacker|target|judge` (default `target`).

## Planned (later phases)

- `attack` - run a single quick objective.
- `campaign` - multi-objective run with budgets and stop conditions (Phase 7).
- `--output sarif|html`, `--fail-on-finding`, `--ci`, `--headless` (CI modes).

The `mcp` server and a JSON driver are implemented; see
[`../features/harness-integration.md`](../features/harness-integration.md).

## Safety behavior

- No command opens a network listener. (A future `api`/`mcp` surface requires an auth token and refuses
  non-loopback binds without auth - see [`../security/SECURITY.md`](../security/SECURITY.md).)
- `run` refuses a target that is not marked `authorized: true`.
- Host-affecting tools stay off by default; there is no flag that silently enables them.
- Errors return a non-zero exit code with a useful message, not a stack trace (config errors exit `2`).

## Examples

```bash
# Fully local, free run against an Ollama model (no API key)
modelwrecker run examples/local-model.yaml

# Through OpenRouter, JSON output
export OPENROUTER_API_KEY=sk-or-...
modelwrecker run examples/openrouter.yaml --output json

# Check connectivity before spending anything
modelwrecker provider test examples/openrouter.yaml --role target
```
