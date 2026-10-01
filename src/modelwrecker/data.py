"""Core data models that flow through the pipeline.

These are the contracts between stages (see docs/architecture/DATA-MODEL.md). Pydantic v2 models so
they validate at the boundary. IDs are short sortable strings; times are UTC.

Objective -> AttackPlan -> Attempt -> Observation -> Verdict -> Confidence -> Finding -> Evidence
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


def _new_id() -> str:
    """A short unique id. ULIDs are the eventual target; uuid4 hex is fine for now."""
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --- enums -----------------------------------------------------------------------------------------


class Outcome(str, Enum):
    REFUSED = "refused"
    PARTIAL = "partial"
    SUCCESS = "success"
    ERROR = "error"


class Confidence(str, Enum):
    RELIABLE = "reliable"
    FLAKY = "flaky"
    DOES_NOT_HOLD = "does_not_hold"


class Severity(str, Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class FindingStatus(str, Enum):
    OPEN = "open"
    TRIAGED = "triaged"
    FIXED = "fixed"
    ACCEPTED_RISK = "accepted-risk"


# --- taxonomy --------------------------------------------------------------------------------------


class TaxonomyRef(BaseModel):
    """One mapping to a standard security taxonomy entry.

    Never invented: the taxonomy module validates each ref against the official tables before a finding
    is written (see docs/architecture/TAXONOMY.md).
    """

    framework: str  # e.g. "owasp_llm", "owasp_asi", "owasp_mcp", "mitre_atlas"
    id: str  # e.g. "LLM01", "ASI01", "MCP03", "AML.T0051"
    edition: str | None = None  # e.g. "2025" or "2026"
    title: str | None = None


# --- pipeline objects ------------------------------------------------------------------------------


class Objective(BaseModel):
    id: str = Field(default_factory=_new_id)
    title: str
    description: str = ""
    category: str = "harmful"  # see docs/research/taxonomies.md for the category set
    success_criteria: str = ""
    candidate_taxonomy: list[TaxonomyRef] = Field(default_factory=list)


class AttackPlan(BaseModel):
    id: str = Field(default_factory=_new_id)
    objective_id: str
    strategy: str
    strategy_params: dict = Field(default_factory=dict)
    use_payload_transforms: bool = False
    transform_chain: list[dict] = Field(default_factory=list)
    rationale: str = ""
    prior_results_summary: str = ""


class ToolCall(BaseModel):
    name: str
    args: dict = Field(default_factory=dict)


class Attempt(BaseModel):
    id: str = Field(default_factory=_new_id)
    plan_id: str
    objective_id: str
    payload: str
    delivery: str = "single_turn"  # single_turn | multi_turn | tool_call | image
    transform_chain: list[dict] = Field(default_factory=list)
    provider_meta: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=_now)


class Observation(BaseModel):
    id: str = Field(default_factory=_new_id)
    attempt_id: str
    response: str = ""
    reasoning: str = ""
    tool_calls: list[ToolCall] = Field(default_factory=list)
    target_meta: dict = Field(default_factory=dict)
    raw: dict = Field(default_factory=dict)  # redacted before storage


class SignalResult(BaseModel):
    signal: str
    hit: bool
    score: float = 0.0  # 0..1
    detail: str = ""
    evidence: dict = Field(default_factory=dict)  # redacted specifics


class Verdict(BaseModel):
    id: str = Field(default_factory=_new_id)
    observation_id: str
    outcome: Outcome
    signals: list[SignalResult] = Field(default_factory=list)
    score: int = 0  # 0..10 severity-of-bypass
    rationale: str = ""
    taxonomy_applied: list[TaxonomyRef] = Field(default_factory=list)


class ReliabilityResult(BaseModel):
    id: str = Field(default_factory=_new_id)
    attempt_id: str
    attempts_run: int = 0
    successes: int = 0
    partials: int = 0
    success_rate: float = 0.0
    confidence: Confidence = Confidence.DOES_NOT_HOLD
    backend_pinned: bool = False


class Evidence(BaseModel):
    id: str = Field(default_factory=_new_id)
    finding_id: str = ""
    target: dict = Field(default_factory=dict)  # redacted connection info
    objective: Objective | None = None
    strategy: str = ""
    strategy_params: dict = Field(default_factory=dict)
    payload: str = ""
    transform_chain: list[dict] = Field(default_factory=list)
    target_response: str = ""
    target_reasoning: str = ""
    tool_calls: list[ToolCall] = Field(default_factory=list)
    judge_result: Verdict | None = None
    reliability: ReliabilityResult | None = None
    model: dict = Field(default_factory=dict)
    provider: dict = Field(default_factory=dict)
    configuration: dict = Field(default_factory=dict)
    attack_sequence: list[dict] = Field(default_factory=list)
    reproduction_steps: str = ""
    created_at: datetime = Field(default_factory=_now)


class Finding(BaseModel):
    id: str = Field(default_factory=_new_id)
    objective_id: str
    attempt_id: str
    severity: Severity = Severity.MEDIUM
    title: str = ""
    summary: str = ""
    taxonomy: list[TaxonomyRef] = Field(default_factory=list)
    evidence_id: str = ""
    status: FindingStatus = FindingStatus.OPEN
    run_id: str = ""
    created_at: datetime = Field(default_factory=_now)
