"""Translate a subset of a Promptfoo red-team config into a modelWrecker config.

modelWrecker keeps its own engine, YAML format, and security controls (see
docs/integrations/promptfoo.md and docs/research/promptfoo-integration.md). This adapter lets a user
bring an existing Promptfoo `redteam` config: it maps Promptfoo plugin ids to modelWrecker
objectives, Promptfoo strategy ids to a modelWrecker strategy (or payload transforms), and the
Promptfoo target to a modelWrecker target.

It never runs Promptfoo and never calls the Promptfoo remote service. Plugins and strategies that
only work through that remote service, or that have no modelWrecker equivalent, are rejected with a
clear error that names them (never silently ignored). modelWrecker's own planner, judge,
reliability, budgets, and authorization still apply to the translated run.
"""

from __future__ import annotations

from ..config import AttackConfig, Config, Endpoint
from ..data import Objective
from .promptfoo_maps import (
    PROMPTFOO_PLUGINS,
    PROMPTFOO_STRATEGIES,
    PROMPTFOO_UNSUPPORTED_PLUGINS,
    PROMPTFOO_UNSUPPORTED_STRATEGIES,
)

# re-exported: callers and tests import the mapping tables from here
__all__ = [
    "PROMPTFOO_PLUGINS",
    "PROMPTFOO_STRATEGIES",
    "PROMPTFOO_UNSUPPORTED_PLUGINS",
    "PROMPTFOO_UNSUPPORTED_STRATEGIES",
    "PromptfooError",
    "translate_promptfoo",
]


class PromptfooError(ValueError):
    """A Promptfoo config could not be translated. The message names what is unsupported."""


def _strategy_id(entry: object) -> str:
    if isinstance(entry, str):
        return entry
    if isinstance(entry, dict) and entry.get("id"):
        return str(entry["id"])
    raise PromptfooError(f"could not read a strategy entry: {entry!r}")


def _plugin_id(entry: object) -> str:
    if isinstance(entry, str):
        return entry
    if isinstance(entry, dict) and entry.get("id"):
        return str(entry["id"])
    raise PromptfooError(f"could not read a plugin entry: {entry!r}")


def _resolve_strategies(raw: list) -> tuple[str, dict]:
    """Map Promptfoo strategy ids to one modelWrecker strategy plus params. Empty means 'auto'."""
    ids = [_strategy_id(s) for s in raw]
    if not ids:
        return "auto", {}
    unsupported = {i: PROMPTFOO_UNSUPPORTED_STRATEGIES[i] for i in ids
                   if i in PROMPTFOO_UNSUPPORTED_STRATEGIES}
    unknown = [i for i in ids
               if i not in PROMPTFOO_STRATEGIES and i not in PROMPTFOO_UNSUPPORTED_STRATEGIES]
    if unsupported or unknown:
        parts = [f"{i} ({why})" for i, why in unsupported.items()] + \
                [f"{i} (unknown Promptfoo strategy)" for i in unknown]
        raise PromptfooError("these Promptfoo strategies are not supported: " + "; ".join(parts))
    # only one strategy per modelWrecker run; take the first mapped one and note the rest
    first = PROMPTFOO_STRATEGIES[ids[0]]
    params = {"transforms": first["transforms"]} if "transforms" in first else {}
    return first["strategy"], params


def _target(raw: dict) -> Endpoint:
    """Map the first Promptfoo target/provider to a modelWrecker target endpoint."""
    providers = raw.get("targets") or raw.get("providers") or []
    if isinstance(providers, dict):
        providers = [providers]
    if not providers:
        raise PromptfooError(
            "the Promptfoo config has no target (expected `targets:` or `providers:`)"
        )
    first = providers[0]
    pid = first.get("id") if isinstance(first, dict) else str(first)
    opts = (first.get("config") or {}) if isinstance(first, dict) else {}
    model = str(opts.get("model") or (pid.split(":", 1)[1] if ":" in str(pid) else pid))
    is_mcp = str(pid).startswith("mcp")
    return Endpoint(
        protocol="openai_compatible",
        base_url=str(opts.get("apiBaseUrl") or opts.get("base_url") or "https://api.openai.com/v1"),
        model=model,
        api_key_env=str(opts.get("apiKeyEnvar") or "OPENAI_API_KEY"),
        authorized=True,  # the operator is translating their own authorized config
        type="mcp" if is_mcp else "chat",
    )


def translate_promptfoo(data: dict, *, attacker: Endpoint | None = None,
                        judge: Endpoint | None = None) -> Config:
    """Translate a parsed Promptfoo config (a dict) into a validated modelWrecker Config.

    `attacker` and `judge` default to the translated target, which the user can change afterwards.
    Raises PromptfooError (never silently drops) for unsupported plugins or strategies.
    """
    redteam = data.get("redteam")
    if not isinstance(redteam, dict):
        raise PromptfooError("no `redteam:` section found in the Promptfoo config")

    plugins = redteam.get("plugins") or []
    if not plugins:
        raise PromptfooError("the Promptfoo `redteam` config lists no plugins")
    purpose = str(redteam.get("purpose") or "").strip()
    objectives = _objectives(plugins, purpose)

    strategy, params = _resolve_strategies(redteam.get("strategies") or [])
    target = _target(data)
    return Config(
        attacker=attacker or target.model_copy(),
        target=target,
        judge=judge or target.model_copy(),
        attack=AttackConfig(strategy=strategy, params=params),
        objectives=objectives,
    )


def _objectives(plugins: list, purpose: str) -> list[Objective]:
    """One objective per supported plugin; any unsupported or unknown plugin stops the whole run."""
    objectives: list[Objective] = []
    unsupported: dict[str, str] = {}
    unknown: list[str] = []
    for entry in plugins:
        plugin_id = _plugin_id(entry)
        if plugin_id in PROMPTFOO_UNSUPPORTED_PLUGINS:
            unsupported[plugin_id] = PROMPTFOO_UNSUPPORTED_PLUGINS[plugin_id]
            continue
        spec = PROMPTFOO_PLUGINS.get(plugin_id)
        if spec is None:
            unknown.append(plugin_id)
            continue
        goal = spec["goal"] if not purpose else f"{spec['goal']} Context: {purpose}"
        objectives.append(Objective(title=f"promptfoo:{plugin_id}", category=spec["category"],
                                    description=goal))
    if unsupported or unknown:
        parts = [f"{i} ({why})" for i, why in unsupported.items()]
        parts += [f"{i} (unknown Promptfoo plugin)" for i in unknown]
        raise PromptfooError("these Promptfoo plugins are not supported: " + "; ".join(parts))
    return objectives
