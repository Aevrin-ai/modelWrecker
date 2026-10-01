# Environment variables

**Status: proposed.** Source of truth for env vars. Add a row here whenever code reads a new one.
Secrets live in env (or a secret manager), never in tracked config.

| Variable | Purpose | Default |
|----------|---------|---------|
| `OPENAI_API_KEY` | OpenAI (and OpenAI-compatible) auth | - |
| `ANTHROPIC_API_KEY` | Anthropic auth | - |
| `OPENROUTER_API_KEY` | OpenRouter auth (via openai_compatible) | - |
| `MODELWRECKER_CONFIG` | path to the config file | `./modelwrecker.yaml` |
| `MODELWRECKER_OUT_DIR` | base dir for runs/evidence/reports | `./runs` |
| `MODELWRECKER_LOG_LEVEL` | log verbosity | `info` |
| `MODELWRECKER_ALLOW_HOST_TOOLS` | emergency global off-switch mirror of the config flag; `true` only with intent | `false` |
| `MODELWRECKER_EGRESS_ALLOW_PRIVATE` | allow private IPs (dangerous; off) | `false` |
| `MODELWRECKER_API_TOKEN` | required auth token if the optional API is ever run | - |

Rules:
- Any `*_API_KEY` is referenced by name from config (`api_key_env`), resolved here, and **redacted** in
  all logs/evidence.
- `MODELWRECKER_EGRESS_ALLOW_PRIVATE=true` is only for testing a target that legitimately lives on a
  private address, and prints a loud warning. See [`../security/SECURITY.md`](../security/SECURITY.md).
- The optional API refuses to start on a non-loopback bind unless `MODELWRECKER_API_TOKEN` is set.
