"""The one question the engine asks before a run: can this run, and how much of it? (ADR-0018)

`check_run` is called once at the start of `run_config`, before any model is contacted. It refuses a
run that needs a feature the plan does not include, or that the monthly limits no longer allow, and
returns how many attack attempts are left so the campaign budget can be capped. Strategies the plan
does not include are skipped with a note during the run. `record_run` counts the finished run.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..config import ConfigError
from .model import Entitlement
from .store import effective_usage, load, record_usage

UPGRADE = ("Upgrade at https://app.aevrin.net/dashboard/billing, then run "
           "`modelwrecker plan --refresh`.")


class EntitlementDenied(ConfigError):
    """The plan does not allow this run. The message says why and what to do.

    A ConfigError, so every caller that already reports config problems cleanly reports this too.
    """


@dataclass
class RunAllowance:
    entitlement: Entitlement
    source: str
    remaining_attempts: int | None  # None = no plan cap
    notes: list[str] = field(default_factory=list)

    def strategy_allowed(self, name: str) -> bool:
        return self.entitlement.strategy_allowed(name)


def _plan_label(ent: Entitlement) -> str:
    return ent.plan.capitalize() if ent.signed else "the free baseline"


def check_run(config, *, now: float | None = None) -> RunAllowance:
    ent, source = load(now)
    label = _plan_label(ent)
    notes: list[str] = []
    if not ent.signed:
        notes.append(f"plan: {source}")

    if not ent.target_allowed(config.target.type):
        raise EntitlementDenied(f"MCP targets are not included in {label}. {UPGRADE}")
    chosen = (config.attack.strategy if config.attack else "auto") or "auto"
    if chosen != "auto" and not ent.strategy_allowed(chosen):
        raise EntitlementDenied(f"the {chosen!r} strategy is not included in {label}. {UPGRADE}")

    used = effective_usage(ent, now)
    runs_cap = ent.limit("campaigns")
    if runs_cap is not None and used["campaigns"] >= runs_cap:
        raise EntitlementDenied(f"{label} allows {runs_cap} campaign runs a month and this month's "
                                f"are used. {UPGRADE}")
    attempts_cap = ent.limit("attacks")
    remaining = None
    if attempts_cap is not None:
        remaining = attempts_cap - used["attacks"]
        if remaining <= 0:
            raise EntitlementDenied(f"{label} allows {attempts_cap} attack attempts a month and "
                                    f"this month's are used. {UPGRADE}")
    return RunAllowance(entitlement=ent, source=source, remaining_attempts=remaining, notes=notes)


def record_run(attempts: int, *, now: float | None = None) -> None:
    record_usage(campaigns=1, attacks=max(0, attempts), now=now)
