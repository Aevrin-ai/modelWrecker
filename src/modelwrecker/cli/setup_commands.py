"""Commands that set up and check a config: `version`, `init`, `check`, and `validate`."""

from __future__ import annotations

from pathlib import Path

import typer

from .. import __version__
from .app import app, load_config_or_exit
from .starter_config import STARTER_CONFIG


@app.command()
def version() -> None:
    """Print the version."""
    typer.echo(f"modelwrecker {__version__}")


@app.command()
def init(path: str = typer.Argument("modelwrecker.yaml",
                                    help="where to write the starter config")) -> None:
    """Write a starter config you can edit and run."""
    config_path = Path(path)
    if config_path.exists():
        typer.secho(f"{config_path} already exists; not overwriting", fg=typer.colors.YELLOW)
        raise typer.Exit(code=1)
    config_path.write_text(STARTER_CONFIG, encoding="utf-8")
    typer.secho(f"wrote {config_path}", fg=typer.colors.GREEN)
    typer.echo("Edit it, set your API key env var, then: modelwrecker validate " + str(config_path))


@app.command()
def check(config: str = typer.Argument("modelwrecker.yaml")) -> None:
    """Validate a config and show which API keys resolve from the environment."""
    cfg = load_config_or_exit(config)
    typer.secho("config OK", fg=typer.colors.GREEN)
    for role in ("attacker", "target", "judge"):
        endpoint = getattr(cfg, role)
        if endpoint is None:
            typer.echo(f"  {role}: (not set)")
            continue
        key = "present" if endpoint.has_key() else "absent"
        extra = " authorized" if role == "target" and endpoint.authorized else ""
        typer.echo(f"  {role}: {endpoint.protocol} {endpoint.model} (api key: {key}){extra}")
    typer.echo(f"  objectives: {len(cfg.objectives)}")
    typer.echo(f"  attack strategy: {cfg.attack.strategy}")
    campaign = cfg.campaign
    typer.echo(f"  campaign: concurrency={campaign.concurrency} stop_on={campaign.stop_on} "
               f"retries={campaign.retries}")


@app.command()
def validate(config: str = typer.Argument("modelwrecker.yaml")) -> None:
    """Validate a config file (schema, protocols, authorization, objectives)."""
    problems = load_config_or_exit(config).problems()
    if problems:
        for problem in problems:
            typer.secho(f"  - {problem}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=2)
    typer.secho("valid and ready to run", fg=typer.colors.GREEN)
