"""What one run of the attack loop produces: the findings, the transcript, and the run's numbers."""

from __future__ import annotations

from dataclasses import dataclass, field

from ..data import Finding


@dataclass
class AttemptRecord:
    """One transcript line for the report: what we sent and what the model replied."""
    objective: str
    strategy: str
    prompt_sent: str
    model_response: str
    outcome: str  # success | partial | refused | error
    score: int
    objective_category: str = ""  # carried for per-category analytics
    control: bool = False  # a benign control attempt (measures false positives), never a finding


@dataclass
class RunResult:
    run_id: str
    findings: list[Finding] = field(default_factory=list)
    calibration: dict = field(default_factory=dict)
    objectives_run: int = 0
    notes: list[str] = field(default_factory=list)
    attempts: list[AttemptRecord] = field(default_factory=list)
    # one row per strategy actually run: attempts, confirmed failures, benign-control failures
    strategy_metrics: list[dict] = field(default_factory=list)
    # strategies skipped because the target cannot support them: {strategy, reason}
    not_tested: list[dict] = field(default_factory=list)
    # request, token, and cost totals for the run, from providers.meter.Meter.summary()
    usage: dict = field(default_factory=dict)
