# Environment variables

Source of truth for env vars. Add a row here whenever code reads a new one. Secrets live in env (or a
secret manager), never in tracked config. `.env.example` at the repo root lists the variables the engine
reads today, with placeholders; Docker loads them from `.env` (see
[`../deployment/docker.md`](../deployment/docker.md)).

## Read by the engine today

| Variable | Purpose | Default |
|----------|---------|---------|
| `OPENROUTER_API_KEY` | OpenRouter auth (via `openai_compatible`); used by the examples | - |
| `OPENAI_API_KEY` | OpenAI (and OpenAI-compatible) auth | - |
| `ANTHROPIC_API_KEY` | Anthropic auth (the direct adapter is not built yet) | - |
| `MODELWRECKER_CONFIG` | config path for `load_config()` when no path is passed. The CLI always passes one, so CLI commands ignore it | `modelwrecker.yaml` |
| `MODELWRECKER_CLOUD_URL` | base URL of the cloud API for `login` and `sync`. Must be https; plain http is allowed only for `localhost` or `127.0.0.1` (local Worker development) | `https://app.aevrin.net/api/v1` |
| `MODELWRECKER_ENTITLEMENT` | a signed entitlement (from `GET /api/v1/device/entitlement`) for CI machines that never run `login`. Takes precedence over the stored `entitlement.jws`. Signed, so it grants nothing if edited | - |
| `MODELWRECKER_DEVICE_TOKEN` | device token (`mwd_...`) for `sync` and auto-sync after `run`, for CI where `login` cannot open a browser. Takes precedence over the saved credential file. Secret: never logged | - |

The three key names are conventions, not hard-coded reads: the engine reads whatever variable a config
names in `api_key_env`, so any name works.

## Planned, not read by code yet

These are reserved names. Setting them today has no effect.

| Variable | Purpose | Default |
|----------|---------|---------|
| `MODELWRECKER_OUT_DIR` | base dir for runs/evidence/reports (today: `run --out-dir`, default `runs`) | `./runs` |
| `MODELWRECKER_LOG_LEVEL` | log verbosity | `info` |
| `MODELWRECKER_ALLOW_HOST_TOOLS` | emergency global off-switch mirror of the config flag; `true` only with intent | `false` |
| `MODELWRECKER_EGRESS_ALLOW_PRIVATE` | allow private IPs (dangerous; off) | `false` |
| `MODELWRECKER_API_TOKEN` | required auth token if the optional API is ever run | - |
| `MW_MCP_TOKEN` | shared token for a future networked MCP transport (#14). The MCP server today runs only over local stdio, where no token is checked; an `authorize()` hook exists in `mcp/service.py` but no transport calls it yet | - |

The device credential file location follows `XDG_CONFIG_HOME` (Linux and macOS) or `APPDATA`
(Windows); see [`CLI.md`](CLI.md#dashboard-sign-in-and-sync-phase-104-108-109).

## Docker Compose only

Read by `docker compose` from `.env` when it builds and starts the container. The engine never sees them.

| Variable | Purpose | Default |
|----------|---------|---------|
| `MODELWRECKER_UID` / `MODELWRECKER_GID` | user and group the container runs as; set to your own ids on Linux | `10001` |
| `MODELWRECKER_EXTRAS` | extras installed into the image at build time, for example `mcp,attacks` | `mcp` |

## Rules

- Any `*_API_KEY` is referenced by name from config (`api_key_env`), resolved here, and **redacted** in
  all logs/evidence.
- `MODELWRECKER_DEVICE_TOKEN` is redacted the same way: the redactor masks any `mwd_...` value.
- `MODELWRECKER_EGRESS_ALLOW_PRIVATE=true` is not built yet. Today the opt-in lives in the config:
  `security.egress.allow_hosts` names the exact private host to allow (for example `localhost` for a
  local model), which is narrower than allowing every private address. It is only for testing a target
  that legitimately lives on a private address. See [`../security/SECURITY.md`](../security/SECURITY.md).
- The optional API refuses to start on a non-loopback bind unless `MODELWRECKER_API_TOKEN` is set.
