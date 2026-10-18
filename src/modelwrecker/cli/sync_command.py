"""The `sync` command: list the runs that are not synced yet, then send them to the dashboard."""

from __future__ import annotations

from contextlib import ExitStack
from pathlib import Path
from typing import TYPE_CHECKING

import typer

from .app import app
from .cloud_session import load_credential_or_exit, load_credential_quietly, sync_client

if TYPE_CHECKING:
    from ..cloud import CloudClient, DeviceCredential, SyncPolicy, SyncReport


@app.command("sync")
def sync_command(runs_dir: str = typer.Option("runs", help="directory that holds run folders"),
                 dry_run: bool = typer.Option(
                     False, "--dry-run",
                     help="list the runs that would be sent and send nothing (no sign-in needed)",
                 ),
                 resync: bool = typer.Option(
                     False, "--resync",
                     help="send every run again, including runs that were already synced",
                 ),
                 metadata_only: bool = typer.Option(
                     False, "--metadata-only",
                     help="send summary metadata only, even if evidence or transcripts are on in "
                          "the dashboard",
                 )) -> None:
    """Send every run that is not synced yet to the dashboard.

    Summary metadata always. Evidence and transcripts only when they are turned on in the dashboard
    (Settings, What syncs to Aevrin); runs synced before that are sent again with the detail.
    The runs are listed before anything is sent. Use --dry-run to only list them.
    """
    from ..cloud import pending_runs, sync_pending

    cred = _credential_for_sync(dry_run)
    with ExitStack() as stack:
        client = _open_client(stack, cred, dry_run)
        policy = _read_policy(client, metadata_only)
        pending = pending_runs(runs_dir, policy, resync=resync)
        if not pending:
            typer.echo(f"nothing to sync in {runs_dir}")
            return
        _list_pending(pending, runs_dir, policy, dry_run)
        if dry_run:
            typer.echo("dry run: nothing was sent. Run `modelwrecker sync` to send these.")
            return
        report = sync_pending(client, runs_dir, policy, resync=resync)
    _print_report(report)


def _credential_for_sync(dry_run: bool) -> DeviceCredential | None:
    """A dry run needs no sign-in; a real sync exits with code 1 when there is no credential."""
    if dry_run:
        return load_credential_quietly()
    cred = load_credential_or_exit()
    if cred is None:
        typer.secho("not signed in. Run `modelwrecker login` or set MODELWRECKER_DEVICE_TOKEN.",
                    fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1)
    return cred


def _open_client(stack: ExitStack, cred: DeviceCredential | None,
                 dry_run: bool) -> CloudClient | None:
    from ..cloud import CloudError

    if cred is None:
        return None
    try:
        return stack.enter_context(sync_client(cred))
    except CloudError as e:
        if dry_run:
            # a dry run only lists runs, so it carries on without a client
            return None
        typer.secho(f"error: {e.message}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=2) from e


def _read_policy(client: CloudClient | None, metadata_only: bool) -> SyncPolicy:
    """Ask the dashboard which detail is turned on, falling back to summary metadata only."""
    from ..cloud import METADATA_ONLY, CloudError

    policy = METADATA_ONLY
    # the policy read is also the device heartbeat, so it runs even with --metadata-only
    if client is not None:
        try:
            policy = client.sync_policy()
        except CloudError:
            typer.secho("note: could not read the dashboard's sync settings, so only summary "
                        "metadata will be sent", fg=typer.colors.YELLOW)
    if metadata_only:
        return METADATA_ONLY
    return policy


def _list_pending(pending: list[Path], runs_dir: str, policy: SyncPolicy, dry_run: bool) -> None:
    verb = "would be sent" if dry_run else "to send"
    what = ("summary metadata only; evidence and transcripts stay on this machine"
            if not policy.any_detail else
            f"{policy.describe()}, as set in the dashboard; secrets are redacted")
    typer.echo(f"{len(pending)} run(s) {verb} from {runs_dir} ({what}):")
    for run_dir in pending:
        typer.echo(_preview_line(run_dir))


def _preview_line(run_dir: Path) -> str:
    """One listing line: the run's summary numbers, never its content."""
    from ..cloud import is_synced, preview_run

    preview = preview_run(run_dir)
    if preview.problem:
        return f"  {preview.name}  {preview.problem}"
    again = "  [synced before, sending again]" if is_synced(run_dir) else ""
    return (f"  {preview.name}  {preview.target}  {preview.attempts} attempt(s)  "
            f"{preview.findings} finding(s)  started {preview.started_at}{again}")


def _print_report(report: SyncReport) -> None:
    typer.secho(f"synced {len(report.synced)} run(s)", fg=typer.colors.GREEN)
    if report.deferred:
        typer.secho(f"{len(report.deferred)} run(s) kept locally to retry later:",
                    fg=typer.colors.YELLOW)
        for run_name, why in report.deferred:
            typer.echo(f"  {run_name}: {why}")
    if report.refused:
        typer.secho(f"{len(report.refused)} run(s) refused by the cloud API:",
                    fg=typer.colors.RED, err=True)
        for run_name, why in report.refused:
            typer.secho(f"  {run_name}: {why}", err=True)
        raise typer.Exit(code=1)
