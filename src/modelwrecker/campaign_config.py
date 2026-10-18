"""Campaign config: how a run schedules its objectives, and the budgets that end it cleanly."""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from .config_error import ConfigError

STOP_CONDITIONS = {"complete", "first_finding", "budget"}


class BudgetConfig(BaseModel):
    """Caps that end a campaign cleanly with partial results (see docs/campaigns/OVERVIEW.md).

    `None` means no cap for that dimension. Budgets are checked before each objective and before
    each strategy, and the wall-clock deadline is checked at those same points.
    """

    model_config = {"extra": "forbid"}
    max_objectives: int | None = None  # cap how many objectives are scheduled
    max_attempts: int | None = None  # total strategy attempts across the whole campaign
    max_tokens: int | None = None  # total target tokens (prompt + completion) across the campaign
    max_requests: int | None = None  # total model requests across ALL roles and replays
    max_cost_usd: float | None = None  # total estimated cost (needs per-endpoint prices)
    max_seconds: int | None = None  # wall-clock budget; falls back to engine.deadline_seconds


class CampaignConfig(BaseModel):
    """How a run schedules its objectives: parallelism, stop condition, retries, and budgets."""

    model_config = {"extra": "forbid"}
    concurrency: int = 1  # objectives run in parallel, up to this many at once
    stop_on: str = "complete"  # complete | first_finding | budget
    retries: int = 0  # bounded retries per objective, transient provider errors only
    budget: BudgetConfig = Field(default_factory=BudgetConfig)

    @model_validator(mode="after")
    def _check(self) -> CampaignConfig:
        if self.concurrency < 1:
            raise ConfigError("campaign.concurrency must be at least 1")
        if self.retries < 0:
            raise ConfigError("campaign.retries cannot be negative")
        if self.stop_on not in STOP_CONDITIONS:
            raise ConfigError(
                f"unknown campaign.stop_on {self.stop_on!r}; one of {sorted(STOP_CONDITIONS)}"
            )
        return self
