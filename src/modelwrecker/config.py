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
    model_config = {"extra": "forbid"}
    allowed_schemes: list[str] = Field(default_factory=lambda: ["https"])
    block_private: bool = True  # loopback / link-local / RFC1918 / metadata


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


class Config(BaseModel):
    model_config = {"extra": "forbid"}

    attacker: Endpoint | None = None
    target: Endpoint | None = None
    judge: Endpoint | None = None
    objectives: list[Objective] = Field(default_factory=list)
    engine: EngineConfig = Field(default_factory=EngineConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)

    def require_full(self) -> None:
        """Raise if the three roles needed for a full run are not all configured."""
        missing = [r for r in ("attacker", "target", "judge") if getattr(self, r) is None]
        if missing:
            raise ConfigError(f"missing required endpoints: {', '.join(missing)}")


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
