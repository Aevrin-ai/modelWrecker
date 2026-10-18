"""Commands that list building blocks or bring them in: strategies, datasets, Promptfoo, MCP."""

from __future__ import annotations

from pathlib import Path

import typer

from .app import app


@app.command()
def strategies() -> None:
    """List the attack strategies that are available."""
    from ..strategies.registry import list_strategies

    for item in list_strategies():
        caps = ",".join(item["required_capabilities"])
        spec = item.get("spec") or {}
        maturity = spec.get("maturity", "")
        tag = f" [{maturity}]" if maturity and maturity != "stable" else ""
        typer.echo(f"{item['name']} (v{item['version']}){tag} - needs [{caps}] - "
                   f"{', '.join(item['taxonomy'])}")
        if spec.get("description"):
            typer.echo(f"    {spec['description']}")
        targets = ", ".join(spec.get("target_types") or [])
        if targets:
            typer.echo(f"    targets: {targets}"
                       + ("  (benign control included)" if spec.get("benign_control") else ""))


@app.command()
def transforms() -> None:
    """List the payload transforms available to the payload engine."""
    from ..payloads import list_transforms

    for transform in list_transforms():
        direction = "reversible" if transform["reversible"] else "one-way"
        typer.echo(f"{transform['name']} (v{transform['version']}) - {direction}")


@app.command("import-promptfoo")
def import_promptfoo(config: str = typer.Argument(
                         ..., help="a Promptfoo config file (its `redteam` section)"),
                     out: str = typer.Option(
                         "", "--out", "-o",
                         help="write the config here, else print to stdout")) -> None:
    """Translate a Promptfoo red-team config into a modelWrecker config.

    modelWrecker stays the engine. Supported plugins and strategies are mapped; unsupported ones
    (remote-only, or no equivalent) stop with a clear error. Attacker and judge default to the
    target; edit them before running. See docs/integrations/promptfoo.md.
    """
    import yaml

    from ..integrations import PromptfooError, translate_promptfoo

    path = Path(config)
    if not path.exists():
        typer.secho(f"not found: {path}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=2)
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as e:
        typer.secho(f"could not parse {path}: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=2) from e
    try:
        cfg = translate_promptfoo(data)
    except PromptfooError as e:
        typer.secho(f"cannot translate: {e}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from e
    text = yaml.safe_dump(cfg.model_dump(exclude_none=True), sort_keys=False)
    if not out:
        typer.echo(text)
        return
    Path(out).write_text(text, encoding="utf-8")
    typer.echo(f"wrote {out}: {len(cfg.objectives)} objective(s), "
               f"strategy {cfg.attack.strategy}")
    typer.echo("review the attacker/judge endpoints (they default to the target) first.")


@app.command()
def datasets(name: str = typer.Argument(
                 "", help="a dataset to fetch and validate; omit to list all"),
             offline: bool = typer.Option(
                 False, help="do not download; use only a cached copy")) -> None:
    """List benchmark datasets, or fetch and validate one (docs/datasets.md).

    Nothing is bundled: a dataset is fetched from its pinned source into a local cache. Set
    MODELWRECKER_DATASETS_OFFLINE=1 (or pass --offline) to forbid downloads.
    """
    from ..datasets import DatasetError, list_datasets, load_cases
    from ..datasets.base import get_dataset

    if not name:
        for info in list_datasets():
            typer.echo(f"{info.name} - {info.title} ({info.license}) - {info.coverage}")
        typer.echo("\nRun `modelwrecker datasets <name>` to fetch and validate one.")
        return
    try:
        info = get_dataset(name)
    except KeyError as e:
        raise typer.BadParameter(str(e)) from e
    try:
        cases = load_cases(name, offline=offline)
    except DatasetError as e:
        typer.echo(f"error: {e}")
        raise typer.Exit(code=1) from e
    benign = sum(1 for case in cases if case.is_benign)
    typer.echo(f"{info.title}: {len(cases)} cases, {benign} benign controls. "
               f"Licence {info.license}.")
    typer.echo(f"Attribution: {info.attribution}")
    typer.echo(f"Pinned at {info.ref[:12]}. Cached; nothing was written to the repository.")


@app.command()
def mcp(runs_dir: str = typer.Option("runs", help="directory the server keeps run artifacts in"),
        config_dir: str = typer.Option(
            ".", help="the only directory the server reads config files from")) -> None:
    """Start the harness-integration MCP server over stdio (Claude Code, Codex, any MCP client)."""
    try:
        from ..mcp.server import build_server
    except ImportError as e:
        typer.secho(
            "the MCP SDK is not installed. Install it with: pip install 'modelwrecker[mcp]'",
            fg=typer.colors.RED, err=True,
        )
        raise typer.Exit(code=2) from e
    build_server(runs_dir=runs_dir, config_dir=config_dir).run()
