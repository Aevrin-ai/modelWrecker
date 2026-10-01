"""Campaign engine: schedule many objectives as one managed run.

See docs/campaigns/OVERVIEW.md. The engine adds parallelism, budgets, stop conditions, and a bounded
retry policy on top of the single-objective attack loop. It owns scheduling only; the attack logic
lives in attacker/loop.py behind the `run_one` callback it is given.
"""

from __future__ import annotations

from .engine import Budget, build_budget, execute_campaign

__all__ = ["Budget", "build_budget", "execute_campaign"]
