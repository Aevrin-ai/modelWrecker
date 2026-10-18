"""The `provider test` command: one small live request to a configured endpoint."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

import typer

from .app import load_config_or_exit, provider_app

if TYPE_CHECKING:
    from ..config import Config, Endpoint


@provider_app.command("test")
def provider_test(config: str = typer.Argument("modelwrecker.yaml"),
                  role: str = typer.Option(
                      "target", help="which endpoint to test: attacker | target | judge")) -> None:
    """Send one small request to a configured provider and report latency, tokens, and errors."""
    cfg = load_config_or_exit(config)
    endpoint = getattr(cfg, role, None)
    if endpoint is None:
        typer.secho(f"no {role} endpoint configured", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=2)

    from ..providers.base import ProviderError

    try:
        asyncio.run(_ping(cfg, endpoint))
    except ProviderError as e:
        typer.secho(f"FAIL: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from e


async def _ping(cfg: Config, endpoint: Endpoint) -> None:
    from ..providers.factory import build_provider, provider_scope

    async with provider_scope():
        provider = build_provider(endpoint, cfg.security.egress.policy())
        health = await provider.health_check()
        if not health.ok:
            typer.secho(f"FAIL: {health.detail}", fg=typer.colors.RED, err=True)
            raise typer.Exit(code=1)
        completion = await provider.generate(
            [{"role": "user", "content": "Reply with the single word: pong"}],
            max_tokens=16, temperature=0,
        )
        typer.secho("PASS", fg=typer.colors.GREEN)
        typer.echo(f"  model: {completion.model}")
        typer.echo(f"  latency: {completion.latency_ms} ms")
        usage = completion.usage
        typer.echo(f"  tokens: prompt={usage.prompt_tokens} completion={usage.completion_tokens}")
        typer.echo(f"  reply: {completion.text[:120]!r}")
