"""The Typer app that every command module registers on, plus the config loader they share."""

from __future__ import annotations

from typing import Annotated

import typer

from .. import __version__
from ..config import Config, ConfigError, load_config

app = typer.Typer(
    add_completion=False,
    help="modelWrecker - an AI red teaming engine. For authorized testing only.",
    no_args_is_help=True,
)
provider_app = typer.Typer(help="Provider connectivity checks.", no_args_is_help=True)
app.add_typer(provider_app, name="provider")


def _print_version(value: bool) -> None:
    if value:
        typer.echo(f"modelwrecker {__version__}")
        raise typer.Exit()


VersionOption = Annotated[
    bool,
    typer.Option("--version", "-V", callback=_print_version, is_eager=True,
                 help="Print the version and exit."),
]


@app.callback()
def main(_version: VersionOption = False) -> None:
    """modelWrecker - an AI red teaming engine. For authorized testing only."""


def load_config_or_exit(config: str) -> Config:
    """Load a config file, or print a clean error and exit with code 2."""
    try:
        return load_config(config)
    except ConfigError as e:
        typer.secho(f"config error: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=2) from e
