"""Configuration models and loader.

Config is YAML, validated by Pydantic. Secrets are NEVER stored in config - only the NAME of the env var
that holds them. See docs/reference/CONFIGURATION.md and docs/reference/ENVIRONMENT.md.
"""

from __future__ import annotations

import os
from pathlib import Path

import yaml
from pydantic import BaseModel, Field, model_validator

from .data import Objective
from .security.egress import EgressBlocked, EgressPolicy

PROTOCOLS = {
    "openai",
    "anthropic",
    "openai_compatible",
    "any_llm",  # default multiplexer (ADR-0003)
    "litellm",
    "portkey",
}


class ConfigError(ValueError):
    """Raised when a config is invalid. Mapped to a clean CLI error, never a stack trace."""


class Endpoint(BaseModel):
    model_config = {"extra": "forbid"}  # unknown keys fail loudly, not silently

    protocol: str = "any_llm"
    base_url: str | None = None
    model: str
    api_key_env: str | None = None  # NAME of an env var, never the key itself
    provider_pin: str | None = None
    timeout: float | None = None
    # Target-only fields:
    type: str | None = None  # target kind: chat (default) | agent | rag | mcp
    authorized: bool = False  # a target MUST be explicitly authorized before it is attacked
    system: str | None = None  # an optional system prompt to plant on the target (self-test)
    target_options: dict = Field(default_factory=dict)  # type-specific config (tools, documents)

    @model_validator(mode="after")
    def _check(self) -> Endpoint:
        if self.protocol not in PROTOCOLS:
            raise ConfigError(
                f"unknown protocol {self.protocol!r}; one of {sorted(PROTOCOLS)}"
            )
        return self

    def resolve_key(self) -> str | None:
        """Resolve the API key from its env var at runtime. Returns None if unset."""
        if not self.api_key_env:
            return None
        return os.environ.get(self.api_key_env)

    def has_key(self) -> bool:
        return self.resolve_key() is not None


class EgressConfig(BaseModel):
    """Where the engine may send model traffic. Enforced on every provider request.

    The default is strict: HTTPS only, and no loopback, link-local, RFC1918, or cloud-metadata
    addresses. To test a local model on purpose, opt in narrowly with `allow_hosts` (and add "http"
    to `allowed_schemes` if it has no TLS). Cloud metadata hosts are blocked even then.
    """

    model_config = {"extra": "forbid"}
    allowed_schemes: list[str] = Field(default_factory=lambda: ["https"])
    block_private: bool = True  # loopback / link-local / RFC1918 / metadata
    allow_hosts: list[str] = Field(default_factory=list)  # e.g. ["localhost"] for a local model

    def policy(self) -> EgressPolicy:
        return EgressPolicy(
            allowed_schemes=tuple(s.lower() for s in self.allowed_schemes),
            allow_private=not self.block_private,
            allow_hosts=tuple(self.allow_hosts),
        )


class SecurityConfig(BaseModel):
    model_config = {"extra": "forbid"}
    egress: EgressConfig = Field(default_factory=EgressConfig)
    redact: bool = True


class EngineConfig(BaseModel):
    model_config = {"extra": "forbid"}
    max_rounds: int = 12
    replays: int = 8  # reliability replay count
    reliable_threshold: float = 0.7
    allow_host_tools: bool = False  # host tools OFF by default (ADR-0008)
    deadline_seconds: int = 1800


class AttackConfig(BaseModel):
    model_config = {"extra": "forbid"}
    strategy: str = "auto"  # "auto" lets the planner choose; or a strategy name
    params: dict = Field(default_factory=dict)


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


class Config(BaseModel):
    model_config = {"extra": "forbid"}

    project: dict | None = None
    attacker: Endpoint | None = None
    target: Endpoint | None = None
    judge: Endpoint | None = None
    attack: AttackConfig = Field(default_factory=AttackConfig)
    objectives: list[Objective] = Field(default_factory=list)
    engine: EngineConfig = Field(default_factory=EngineConfig)
    campaign: CampaignConfig = Field(default_factory=CampaignConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)

    def require_full(self) -> None:
        """Raise if the three roles needed for a full run are not all configured."""
        missing = [r for r in ("attacker", "target", "judge") if getattr(self, r) is None]
        if missing:
            raise ConfigError(f"missing required endpoints: {', '.join(missing)}")

    def require_authorized_target(self) -> None:
        """modelWrecker refuses to attack a target that is not explicitly authorized."""
        if self.target is None:
            raise ConfigError("no target configured")
        if not self.target.authorized:
            raise ConfigError(
                "target is not authorized. Set `authorized: true` on the target in your config to "
                "confirm you have permission to test it. modelWrecker will not attack a target "
                "without explicit authorization."
            )

    def require_objectives(self) -> None:
        if not self.objectives:
            raise ConfigError("no objectives configured; add at least one under `objectives:`")

    def require_egress_allowed(self) -> None:
        """Every endpoint's base_url must pass the egress policy (static check, no DNS)."""
        policy = self.security.egress.policy()
        problems = []
        for role in ("attacker", "target", "judge"):
            ep = getattr(self, role)
            if ep is None or not ep.base_url:
                continue
            try:
                policy.static_check(ep.base_url)
            except EgressBlocked as e:
                problems.append(f"{role}.base_url: {e}")
        if problems:
            raise ConfigError("egress blocked: " + "; ".join(problems))


def load_config(path: str | Path | None = None) -> Config:
    """Load and validate a config file. Env var MODELWRECKER_CONFIG is the default path."""
    p = Path(path or os.environ.get("MODELWRECKER_CONFIG", "modelwrecker.yaml"))
    if not p.exists():
        raise ConfigError(f"config file not found: {p}")
    try:
        data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as e:
        raise ConfigError(f"could not parse {p}: {e}") from e
    try:
        return Config.model_validate(data)
    except ConfigError:
        raise
    except Exception as e:  # pydantic ValidationError -> clean ConfigError
        raise ConfigError(str(e)) from e
