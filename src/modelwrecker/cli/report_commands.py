"""Commands that read finished runs: `report`, `analyze`, and `replay`."""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, Annotated

import typer

from .app import app

if TYPE_CHECKING:
    from ..analytics import Analytics

RunDirs = Annotated[list[str], typer.Argument(help="one or more run directories under runs/")]


@app.command()
def report(run_dir: str = typer.Argument(..., help="a run directory under runs/"),
           output: str = typer.Option("md", help="md | json")) -> None:
    """Render a report from a finished run: findings plus the full attempt transcript."""
    from ..findings.report import load_run, render_json, render_markdown

    run_path = _existing_run_dir(run_dir)
    findings, attempts = load_run(run_path)
    if output == "json":
        typer.echo(render_json(findings, run_path.name, attempts))
    else:
        typer.echo(render_markdown(findings, run_path.name, attempts))


@app.command()
def analyze(run_dirs: RunDirs,
            out_dir: str = typer.Option(
                None, help="where to write artifacts (default: each run's own dir)"),
            formats: str = typer.Option("html,json,csv",
                                        help="comma list: html | json | csv")) -> None:
    """Compute ASR analytics per strategy, category, and taxonomy, plus a leaderboard.

    Output is static HTML, JSON, and CSV files.
    """
    wanted = {name.strip() for name in formats.split(",") if name.strip()}
    runs: list[Analytics] = []
    written: list[Path] = []
    for run_dir in run_dirs:
        analytics, files = _analyze_run(_existing_run_dir(run_dir), out_dir, wanted)
        runs.append(analytics)
        written.extend(files)

    if len(runs) > 1:
        written.extend(_write_leaderboard(runs, out_dir, wanted))

    typer.secho(f"wrote {len(written)} artifact(s)", fg=typer.colors.GREEN)
    for path in written:
        typer.echo(f"  {path}")


@app.command()
def replay(evidence: str = typer.Argument(..., help="an evidence-*.json file from a run")) -> None:
    """Show the recorded payload of a finding. Re-sending it is not built yet (#52)."""
    evidence_path = Path(evidence)
    if not evidence_path.exists():
        typer.secho(f"evidence file not found: {evidence_path}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1)
    data = json.loads(evidence_path.read_text(encoding="utf-8"))
    typer.secho(
        "Re-sending to the target is not built yet (issue #52). The evidence file holds the full "
        "payload and steps to reproduce it by hand.",
        fg=typer.colors.YELLOW,
    )
    typer.echo(f"payload: {data.get('payload', '')[:200]}")


def _existing_run_dir(run_dir: str) -> Path:
    """The run directory as a path, or a clean error and exit code 2 when it is not one."""
    run_path = Path(run_dir)
    if not run_path.is_dir():
        typer.secho(f"not a run directory: {run_path}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=2)
    return run_path


def _analyze_run(run_path: Path, out_dir: str | None,
                 wanted: set[str]) -> tuple[Analytics, list[Path]]:
    """Compute one run's analytics, write the wanted formats, and print its one-line summary."""
    from ..analytics import (
        compute_analytics,
        render_analytics_csv,
        render_analytics_html,
        render_analytics_json,
    )
    from ..findings.report import load_run, load_run_meta

    findings, attempts = load_run(run_path)
    label = load_run_meta(run_path).get("target_model") or run_path.name
    analytics = compute_analytics(findings, attempts, label=label)
    renderers = {"html": render_analytics_html, "json": render_analytics_json,
                 "csv": render_analytics_csv}
    dest = Path(out_dir) if out_dir else run_path
    written = _write_artifacts(renderers, analytics, wanted, dest, f"analytics-{run_path.name}")
    typer.echo(f"{label}: ASR {analytics.successes}/{analytics.total_attempts}, "
               f"{analytics.findings_total} finding(s)")
    return analytics, written


def _write_leaderboard(runs: list[Analytics], out_dir: str | None,
                       wanted: set[str]) -> list[Path]:
    from ..analytics import (
        render_leaderboard_csv,
        render_leaderboard_html,
        render_leaderboard_json,
    )

    renderers = {"html": render_leaderboard_html, "json": render_leaderboard_json,
                 "csv": render_leaderboard_csv}
    dest = Path(out_dir) if out_dir else Path(".")
    return _write_artifacts(renderers, runs, wanted, dest, "leaderboard")


def _write_artifacts(renderers: dict[str, Callable[..., str]], data: object, wanted: set[str],
                     dest: Path, stem: str) -> list[Path]:
    """Write `<dest>/<stem>.<format>` for every wanted format, in the renderers' order."""
    dest.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for fmt, render in renderers.items():
        if fmt in wanted:
            target = dest / f"{stem}.{fmt}"
            target.write_text(render(data), encoding="utf-8")
            written.append(target)
    return written
