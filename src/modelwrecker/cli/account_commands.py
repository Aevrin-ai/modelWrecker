"""Commands for this device's cloud account: `login`, `logout`, and `plan`."""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

import typer

from .. import __version__
from . import cloud_session
from .app import app
from .cloud_session import (
    default_device_name,
    format_epoch,
    load_credential_or_exit,
    sync_client,
)

if TYPE_CHECKING:
    from ..cloud import DeviceCredential, TokenResult


@app.command()
def login(name: str = typer.Option(
              None, help="a name for this device in the dashboard (default: hostname)")) -> None:
    """Connect this install to the Aevrin dashboard as a device (OAuth 2.0 device sign-in)."""
    from ..cloud import ENV_TOKEN, DeviceCredential, save_credential

    api_url = _resolve_api_url_or_exit()
    token = _sign_in(api_url, name)
    cred = DeviceCredential(token=token.device_token, device_id=token.device_id,
                            project_id=token.project_id, api_url=api_url)
    path = save_credential(cred)
    typer.secho(f"signed in as device {cred.device_id or '(unknown id)'}", fg=typer.colors.GREEN)
    typer.echo(f"credential saved to {path} (owner-only permissions)")
    _show_plan_after_login(cred)
    if os.environ.get(ENV_TOKEN):
        typer.secho(f"note: {ENV_TOKEN} is set and takes precedence over the saved credential",
                    fg=typer.colors.YELLOW)


def _resolve_api_url_or_exit() -> str:
    from ..cloud import InsecureUrlError, resolve_api_url

    try:
        return resolve_api_url()
    except InsecureUrlError as e:
        typer.secho(f"error: {e.message}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=2) from e


def _sign_in(api_url: str, name: str | None) -> TokenResult:
    """Run the device sign-in and return the approved token, or exit with code 1."""
    import platform

    from ..cloud import CloudError, TokenStatus, poll_for_token

    device_name = (name or default_device_name())[:100]
    os_name = f"{platform.system()} {platform.release()}".strip() or "unknown"
    try:
        with cloud_session._make_cloud_client(api_url, None) as client:
            code = client.device_code(name=device_name, os_name=os_name, engine_version=__version__)
            typer.echo("To connect this device, open this link in your browser:")
            typer.secho(f"  {code.verification_uri_complete}", bold=True)
            typer.echo(f"and check that it shows the code: {code.user_code}")
            typer.echo("Waiting for approval (press Ctrl+C to cancel)...")
            outcome = poll_for_token(client, code, sleep=cloud_session._sleep)
    except CloudError as e:
        typer.secho(f"sign-in failed: {e.message}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from e
    except KeyboardInterrupt as e:
        typer.secho("sign-in cancelled", fg=typer.colors.YELLOW, err=True)
        raise typer.Exit(code=1) from e

    if outcome.status is TokenStatus.DENIED:
        typer.secho("sign-in was denied in the dashboard", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1)
    if outcome.status is not TokenStatus.OK or outcome.token is None:
        typer.secho("the code expired before it was approved; run `modelwrecker login` again",
                    fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1)
    return outcome.token


def _show_plan_after_login(cred: DeviceCredential) -> None:
    from ..cloud import CloudError

    try:
        with sync_client(cred) as client:
            ent = client.refresh_entitlement()
        typer.echo(f"plan: {ent.plan.capitalize()} (signed, valid until "
                   f"{format_epoch(ent.expires_at)})")
    except CloudError as e:
        typer.secho(f"note: could not fetch your plan yet ({e.message}); the free baseline applies "
                    "until `modelwrecker plan --refresh` succeeds", fg=typer.colors.YELLOW)


@app.command()
def logout() -> None:
    """Remove this device's saved credential."""
    from ..cloud import ENV_TOKEN, credential_path, delete_credential
    from ..entitlements import clear_token

    path = credential_path()
    if delete_credential(path):
        typer.secho(f"removed {path}", fg=typer.colors.GREEN)
    else:
        typer.echo("not signed in (no saved credential)")
    # the engine falls back to the free baseline
    clear_token()
    if os.environ.get(ENV_TOKEN):
        typer.secho(f"note: {ENV_TOKEN} is still set in this environment; unset it too",
                    fg=typer.colors.YELLOW)
    typer.echo("To invalidate the token on the server, revoke this device in the dashboard.")


@app.command("plan")
def plan_command(refresh: bool = typer.Option(
                     False, "--refresh", help="fetch a fresh signed entitlement first")) -> None:
    """Show what your plan allows on this machine, and this month's usage."""
    from ..entitlements import effective_usage, load

    if refresh:
        _refresh_plan_or_exit()

    ent, source = load()
    used = effective_usage(ent)
    typer.secho(f"plan: {ent.plan.capitalize()}", bold=True)
    typer.echo(f"source: {source}")
    if ent.signed:
        typer.echo(f"valid until: {format_epoch(ent.expires_at)} (refreshed on login, sync, and "
                   "before a run when older than 12 hours)")
        if ent.plan_ends_at:
            typer.echo(f"paid until: {ent.plan_ends_at}")

    def cap(meter: str) -> str:
        limit = ent.limit(meter)
        return "unlimited" if limit is None else str(limit)

    typer.echo(f"campaign runs this month: {used['campaigns']} of {cap('campaigns')}")
    typer.echo(f"attack attempts this month: {used['attacks']} of {cap('attacks')}")
    for feature, label in (("advanced_strategies", "PyRIT and garak strategies"),
                           ("mcp", "MCP targets")):
        typer.echo(f"{label}: {'yes' if ent.allows(feature) else 'no (Pro)'}")


def _refresh_plan_or_exit() -> None:
    from ..cloud import CloudError

    cred = load_credential_or_exit()
    if cred is None:
        typer.secho("not signed in. Run `modelwrecker login` first.", fg=typer.colors.RED,
                    err=True)
        raise typer.Exit(code=1)
    try:
        with sync_client(cred) as client:
            client.refresh_entitlement()
        typer.secho("fetched a fresh entitlement", fg=typer.colors.GREEN)
    except CloudError as e:
        typer.secho(f"error: {e.message}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from e
