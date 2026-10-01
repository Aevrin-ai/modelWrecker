"""Compute analytics from a run's findings and attempt transcript.

ASR (attack success rate) is measured at the attempt level: successes / attempts. Small N is the
red-team norm, so every rate carries a Wilson confidence interval rather than a bare fraction. A
leaderboard ranks targets by robustness (lower ASR = more robust). See docs/attack-engine/ANALYTICS.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..data import Finding
from ..reliability.replay import wilson_interval

_HIGH_SEVERITY = {"critical", "high"}


def _field(a: object, name: str, default: object = "") -> object:
    """Read one field from an attempt that may be a dict (from events.jsonl) or an AttemptRecord."""
    if isinstance(a, dict):
        if name == "category":
            return a.get("category", a.get("objective_category", default))
        return a.get(name, default)
    if name == "category":
        return getattr(a, "objective_category", default)
    return getattr(a, name, default)


@dataclass
class Breakdown:
    """One slice of ASR, e.g. a single strategy or objective category."""

    key: str
    attempts: int = 0
    successes: int = 0
    partials: int = 0

    @property
    def asr(self) -> float:
        return self.successes / self.attempts if self.attempts else 0.0

    @property
    def ci(self) -> tuple[float, float]:
        return wilson_interval(self.successes, self.attempts)


@dataclass
class Analytics:
    """All measured numbers for one run (one target/model)."""

    label: str = "run"
    total_attempts: int = 0
    successes: int = 0
    partials: int = 0
    refusals: int = 0
    errors: int = 0
    by_strategy: list[Breakdown] = field(default_factory=list)
    by_category: list[Breakdown] = field(default_factory=list)
    findings_total: int = 0
    findings_by_severity: dict[str, int] = field(default_factory=dict)
    by_taxonomy: dict[str, int] = field(default_factory=dict)

    @property
    def asr(self) -> float:
        return self.successes / self.total_attempts if self.total_attempts else 0.0

    @property
    def asr_ci(self) -> tuple[float, float]:
        return wilson_interval(self.successes, self.total_attempts)

    @property
    def robustness(self) -> float:
        """1 - ASR: how often the target held. Higher is safer."""
        return 1.0 - self.asr


def compute_analytics(
    findings: list[Finding], attempts: list[object], label: str = "run"
) -> Analytics:
    """Build the analytics for one run from its findings and attempt transcript."""
    a = Analytics(label=label)
    strat: dict[str, Breakdown] = {}
    cat: dict[str, Breakdown] = {}

    for rec in attempts:
        outcome = str(_field(rec, "outcome", ""))
        strategy = str(_field(rec, "strategy", "")) or "unknown"
        category = str(_field(rec, "category", "")) or "uncategorized"

        a.total_attempts += 1
        if outcome == "success":
            a.successes += 1
        elif outcome == "partial":
            a.partials += 1
        elif outcome == "error":
            a.errors += 1
        else:  # refused or anything else counts as held
            a.refusals += 1

        sb = strat.setdefault(strategy, Breakdown(key=strategy))
        cb = cat.setdefault(category, Breakdown(key=category))
        for b in (sb, cb):
            b.attempts += 1
            if outcome == "success":
                b.successes += 1
            elif outcome == "partial":
                b.partials += 1

    # Most-exercised slices first, then alphabetical for stable output.
    a.by_strategy = sorted(strat.values(), key=lambda b: (-b.attempts, b.key))
    a.by_category = sorted(cat.values(), key=lambda b: (-b.attempts, b.key))

    a.findings_total = len(findings)
    for f in findings:
        sev = f.severity.value
        a.findings_by_severity[sev] = a.findings_by_severity.get(sev, 0) + 1
        for t in f.taxonomy:
            key = f"{t.framework}:{t.id}"
            a.by_taxonomy[key] = a.by_taxonomy.get(key, 0) + 1
    return a


@dataclass
class LeaderboardRow:
    rank: int
    label: str
    asr: float
    ci_low: float
    ci_high: float
    robustness: float
    total_attempts: int
    findings_total: int
    high_severity: int  # critical + high findings


def build_leaderboard(runs: list[Analytics]) -> list[LeaderboardRow]:
    """Rank targets most-robust first (lowest ASR first)."""
    ordered = sorted(runs, key=lambda r: (r.asr, -r.total_attempts, r.label))
    rows: list[LeaderboardRow] = []
    for i, r in enumerate(ordered, start=1):
        low, high = r.asr_ci
        high_sev = sum(v for k, v in r.findings_by_severity.items() if k in _HIGH_SEVERITY)
        rows.append(
            LeaderboardRow(
                rank=i,
                label=r.label,
                asr=r.asr,
                ci_low=low,
                ci_high=high,
                robustness=r.robustness,
                total_attempts=r.total_attempts,
                findings_total=r.findings_total,
                high_severity=high_sev,
            )
        )
    return rows
