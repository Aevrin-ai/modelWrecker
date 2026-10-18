"""The `run` command: check the config and the plan, run the attack loop, and write the report."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

import typer

from ..config import Config, ConfigError
from ..storage.files import new_run_id
from .app import app, load_config_or_exit
from .auto_sync import auto_sync_run, refresh_entitlement_if_stale

if TYPE_CHECKING:
    from ..attacker.loop import RunResult
    from ..entitlements import RunAllowance
    from ..storage.store import RunStore


@app.command()
def run(config: str = typer.Argument("modelwrecker.yaml"),
        output: str = typer.Option("md", help="md | json"),
        out_dir: str = typer.Option("runs", help="base directory for run artifacts"),
        concurrency: int = typer.Option(
            None, help="objectives to run in parallel (overrides config)"),
        stop_on: str = typer.Option(
            None, help="complete | first_finding | budget (overrides config)"),
        max_objectives: int = typer.Option(
            None, help="cap objectives scheduled (overrides config)"),
        max_seconds: int = typer.Option(
            None, help="wall-clock budget in seconds (overrides config)"),
        sync_after: bool = typer.Option(
            None, "--sync/--no-sync",
            help="send the run's summary to the dashboard afterwards (default: only if signed in)",
        )) -> None:
    """Run all objectives in a config against the target, verify, and report."""
    cfg = load_config_or_exit(config)
    try:
        apply_campaign_overrides(cfg, concurrency, stop_on, max_objectives, max_seconds)
        cfg.require_full()
        cfg.require_authorized_target()
        cfg.require_objectives()
    except ConfigError as e:
        typer.secho(f"config error: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=2) from e

    from ..storage.store import RunStore

    allowance = _check_plan(cfg)
    store = RunStore(run_id=new_run_id(), base_dir=out_dir)
    result = _run_attack_loop(cfg, store, allowance)
    for note in result.notes:
        typer.secho(f"note: {note}", fg=typer.colors.YELLOW)
    _write_report(result, store, output)
    # sync is best effort: it never changes this command's exit code or touches local results
    auto_sync_run(store.dir, sync_after)
    if result.findings:
        raise typer.Exit(code=0)


def _check_plan(cfg: Config) -> RunAllowance:
    """Check the plan before anything is created or any model is called."""
    from ..entitlements import EntitlementDenied, check_run

    refresh_entitlement_if_stale()
    try:
        return check_run(cfg)
    except EntitlementDenied as e:
        typer.secho(f"not allowed by your plan: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=2) from e


def _run_attack_loop(cfg: Config, store: RunStore, allowance: RunAllowance) -> RunResult:
    # imported at call time so tests that replace loop.run_config take effect
    from ..attacker.loop import run_config

    def emit(msg: str) -> None:
        typer.echo(f"  {msg}")

    try:
        return asyncio.run(run_config(cfg, store=store, emit=emit, run_id=store.run_id,
                                      allowance=allowance))
    except ConfigError as e:
        typer.secho(f"config error: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=2) from e
    except Exception as e:  # provider/engine failures: clean message, not a stack trace
        typer.secho(f"run failed: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from e


def _write_report(result: RunResult, store: RunStore, output: str) -> None:
    from ..findings.report import render_json, render_markdown

    if output == "json":
        rendered = render_json(result.findings, result.run_id, result.attempts)
        suffix = "json"
    else:
        rendered = render_markdown(result.findings, result.run_id, result.attempts)
        suffix = "md"
    report_path = store.dir / f"report.{suffix}"
    report_path.write_text(rendered, encoding="utf-8")
    typer.echo("")
    typer.echo(rendered)
    typer.secho(f"\nartifacts in {store.dir}", fg=typer.colors.GREEN)


def apply_campaign_overrides(cfg: Config, concurrency: int | None, stop_on: str | None,
                             max_objectives: int | None, max_seconds: int | None) -> None:
    """Apply CLI campaign flags onto the loaded config, re-validating so bad values fail cleanly."""
    from ..config import CampaignConfig

    data = cfg.campaign.model_dump()
    if concurrency is not None:
        data["concurrency"] = concurrency
    if stop_on is not None:
        data["stop_on"] = stop_on
    if max_objectives is not None:
        data["budget"]["max_objectives"] = max_objectives
    if max_seconds is not None:
        data["budget"]["max_seconds"] = max_seconds
    try:
        cfg.campaign = CampaignConfig.model_validate(data)
    except Exception as e:  # pydantic re-wraps our ConfigError; surface just the message
        raise ConfigError(_validation_message(e)) from e


def _validation_message(error: Exception) -> str:
    """The clean "Value error, <msg>" text out of the pydantic noise, else the whole error text."""
    try:
        first = error.errors()[0]["msg"]  # type: ignore[attr-defined]
        return first.removeprefix("Value error, ")
    except Exception:
        # not the pydantic shape we expect: the full error text is still a usable message
        return str(error)
