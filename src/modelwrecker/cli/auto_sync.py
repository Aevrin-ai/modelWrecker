"""Best-effort cloud steps around `run`: refresh the plan before it, sync the summary after it.

Neither step can change a run's result or exit code: any failure is a note or a warning.
"""

from __future__ import annotations

import os
from pathlib import Path

import typer

from .cloud_session import load_credential_quietly, sync_client

# 12 hours: a signed entitlement older than this is refreshed before a run
ENTITLEMENT_STALE_SECONDS = 12 * 60 * 60


def auto_sync_run(run_dir: Path, wanted: bool | None) -> None:
    """Send one finished run after `run`. Any failure is a warning; the run stays queued locally."""
    if wanted is False:
        return
    try:
        from ..cloud import METADATA_ONLY, CloudError, load_credential, sync_run

        cred = load_credential()
        if cred is None:
            if wanted:
                typer.secho("note: not signed in, so the run was not synced. Run `modelwrecker "
                            "login`, then `modelwrecker sync`.", fg=typer.colors.YELLOW, err=True)
            return
        with sync_client(cred) as client:
            try:
                policy = client.sync_policy()
            except CloudError:
                # the sync below reports a real outage
                policy = METADATA_ONLY
            sync_run(client, run_dir, policy)
        extra = f" ({policy.describe()})" if policy.any_detail else ""
        typer.secho(f"synced the run summary to the dashboard{extra}", fg=typer.colors.GREEN)
    except Exception as e:  # never let sync change the run's result
        _warn_sync_failed(e)


def _warn_sync_failed(error: Exception) -> None:
    from ..security.redaction import redact_text

    detail = str(getattr(error, "message", "") or type(error).__name__)
    typer.secho(
        f"warning: sync failed ({redact_text(detail)}). The run is saved locally; "
        "`modelwrecker sync` will send it later.",
        fg=typer.colors.YELLOW, err=True,
    )


def refresh_entitlement_if_stale() -> None:
    """Before a run, fetch a fresh entitlement when signed in and the stored one is old or missing.

    Best effort: offline, the stored entitlement (or the free baseline) applies.
    """
    from ..entitlements import ENV_TOKEN
    from ..entitlements.store import cached_token_age

    if os.environ.get(ENV_TOKEN):
        return
    age = cached_token_age()
    if age is not None and age < ENTITLEMENT_STALE_SECONDS:
        return
    cred = load_credential_quietly()
    if cred is None:
        return
    try:
        with sync_client(cred) as client:
            client.refresh_entitlement()
    except Exception:
        # never block a run on the cloud: the stored entitlement or the free baseline applies
        return
