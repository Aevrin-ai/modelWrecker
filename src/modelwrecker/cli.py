"""modelWrecker command-line interface (skeleton).

Commands mirror docs/reference/CLI.md. The engine loop and adapters are not wired yet (Phase 4 in
progress), so the action commands validate inputs and report what they will do, rather than pretending to
run. `check` already does real work: it validates a config.
"""

from __future__ import annotations

import typer

from . import __version__
from .config import ConfigError, load_config

app = typer.Typer(
    add_completion=False,
    help="modelWrecker - an AI red teaming engine. For authorized testing only.",
    no_args_is_help=True,
)

_NOT_WIRED = (
    "The attack engine is not wired yet (Phase 4 in progress). "
    "See ROADMAP.md and docs/attack-engine/OVERVIEW.md."
)


@app.command()
def version() -> None:
    """Print the version."""
    typer.echo(f"modelwrecker {__version__}")


@app.command()
def check(config: str = typer.Argument("modelwrecker.yaml", help="path to a config file")) -> None:
    """Validate a config: endpoints, protocols, and which API keys resolve from the environment."""
    try:
        cfg = load_config(config)
    except ConfigError as e:
        typer.secho(f"config error: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=2) from e
    typer.secho("config OK", fg=typer.colors.GREEN)
    for role in ("attacker", "target", "judge"):
        ep = getattr(cfg, role)
        if ep is None:
            typer.echo(f"  {role}: (not set)")
            continue
        key = "present" if ep.has_key() else "absent"
        typer.echo(f"  {role}: {ep.protocol} {ep.model} (api key: {key})")
    typer.echo(f"  objectives: {len(cfg.objectives)}")
    typer.echo(f"  host tools allowed: {cfg.engine.allow_host_tools}")


@app.command()
def run(
    config: str = typer.Argument("modelwrecker.yaml"),
    output: str = typer.Option("md", help="md | json | sarif | html"),
) -> None:
    """Run all objectives in a config against the target. (Engine not wired yet.)"""
    cfg = _load_full(config)
    typer.echo(f"would run {len(cfg.objectives)} objective(s) against {cfg.target.model}")  # type: ignore[union-attr]
    typer.echo(f"output format: {output}")
    typer.secho(_NOT_WIRED, fg=typer.colors.YELLOW)


@app.command()
def campaign(config: str = typer.Argument("campaign.yaml")) -> None:
    """Run a multi-objective campaign. (Engine not wired yet.)"""
    _load_full(config)
    typer.secho(_NOT_WIRED, fg=typer.colors.YELLOW)


@app.command()
def validate(finding: str = typer.Argument(..., help="path to a finding.json")) -> None:
    """Re-run reliability on a finding. (Engine not wired yet.)"""
    typer.echo(f"would re-validate {finding}")
    typer.secho(_NOT_WIRED, fg=typer.colors.YELLOW)


@app.command()
def report(run_file: str = typer.Argument(..., help="path to a run.json")) -> None:
    """Render a report from a run. (Engine not wired yet.)"""
    typer.echo(f"would render a report from {run_file}")
    typer.secho(_NOT_WIRED, fg=typer.colors.YELLOW)


@app.command()
def mcp() -> None:
    """Start the harness-integration MCP server. (Not wired yet; see ADR-0013.)"""
    typer.secho(
        "MCP server not wired yet; planned in Phase 9 "
        "(see docs/features/harness-integration.md).",
        fg=typer.colors.YELLOW,
    )


def _load_full(config: str):
    try:
        cfg = load_config(config)
        cfg.require_full()
        return cfg
    except ConfigError as e:
        typer.secho(f"config error: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=2) from e


if __name__ == "__main__":
    app()
