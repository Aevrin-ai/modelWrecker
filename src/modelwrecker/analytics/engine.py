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
    def confidence_interval(self) -> tuple[float, float]:
        """The Wilson 95% interval around `asr`."""
        return wilson_interval(self.successes, self.attempts)

    # the short name stays for existing callers
    ci = confidence_interval


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


def compute_analytics(findings: list[Finding], attempts: list[object],
                      label: str = "run") -> Analytics:
    """Build the analytics for one run from its findings and attempt transcript."""
    analytics = Analytics(label=label)
    by_strategy: dict[str, Breakdown] = {}
    by_category: dict[str, Breakdown] = {}

    for record in attempts:
        outcome = str(_field(record, "outcome", ""))
        strategy = str(_field(record, "strategy", "")) or "unknown"
        category = str(_field(record, "category", "")) or "uncategorized"
        _count_outcome(analytics, outcome)
        for breakdown in (by_strategy.setdefault(strategy, Breakdown(key=strategy)),
                          by_category.setdefault(category, Breakdown(key=category))):
            _count_slice(breakdown, outcome)

    # most-exercised slices first, then alphabetical for stable output
    analytics.by_strategy = sorted(by_strategy.values(), key=lambda b: (-b.attempts, b.key))
    analytics.by_category = sorted(by_category.values(), key=lambda b: (-b.attempts, b.key))
    _count_findings(analytics, findings)
    return analytics


def _count_outcome(analytics: Analytics, outcome: str) -> None:
    analytics.total_attempts += 1
    if outcome == "success":
        analytics.successes += 1
    elif outcome == "partial":
        analytics.partials += 1
    elif outcome == "error":
        analytics.errors += 1
    else:  # refused or anything else counts as held
        analytics.refusals += 1


def _count_slice(breakdown: Breakdown, outcome: str) -> None:
    breakdown.attempts += 1
    if outcome == "success":
        breakdown.successes += 1
    elif outcome == "partial":
        breakdown.partials += 1


def _count_findings(analytics: Analytics, findings: list[Finding]) -> None:
    analytics.findings_total = len(findings)
    for finding in findings:
        severity = finding.severity.value
        analytics.findings_by_severity[severity] = (
            analytics.findings_by_severity.get(severity, 0) + 1)
        for ref in finding.taxonomy:
            key = f"{ref.framework}:{ref.id}"
            analytics.by_taxonomy[key] = analytics.by_taxonomy.get(key, 0) + 1


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
        high_sev = sum(count for severity, count in r.findings_by_severity.items()
                       if severity in _HIGH_SEVERITY)
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
