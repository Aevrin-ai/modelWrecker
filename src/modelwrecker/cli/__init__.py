"""modelWrecker command-line interface.

Commands mirror docs/reference/CLI.md. `run` executes the real attack loop; `check`/`validate`
validate a config; `provider test` does a live connectivity check; `strategies` lists strategies;
`report` renders a finished run; `replay` reproduces a finding; `login`/`logout`/`sync` connect to
the dashboard and send metadata-only run summaries (see src/modelwrecker/cloud). For authorized
testing only.

Each command module registers its commands on `app` when it is imported, so the imports below keep
the order the commands are listed in `--help`.
"""

from __future__ import annotations

# isort: off
from .app import app, main, provider_app
from .setup_commands import check, init, validate, version
from .run_command import run
from .report_commands import analyze, replay, report
from .catalog_commands import datasets, import_promptfoo, mcp, strategies, transforms
from .account_commands import login, logout, plan_command
from .sync_command import sync_command
from .provider_commands import provider_test
# isort: on

__all__ = [
    "analyze",
    "app",
    "check",
    "datasets",
    "import_promptfoo",
    "init",
    "login",
    "logout",
    "main",
    "mcp",
    "plan_command",
    "provider_app",
    "provider_test",
    "replay",
    "report",
    "run",
    "strategies",
    "sync_command",
    "transforms",
    "validate",
    "version",
]
