"""One finding's evidence for the sync body, sent only when the account turned evidence on.

Every field is picked by name, redacted, and capped. The configuration and connection details
(endpoint URLs, API key names, the system prompt) are never included.
"""

from __future__ import annotations

import json
from pathlib import Path

from ..data import Finding
from .run_files import read_evidence
from .summary_values import MAX_TEXT, body_text, bounded_int, label, rate

# these match src/api/src/schemas.ts
EVIDENCE_TEXT_MAX = 20_000
TRANSCRIPT_TEXT_MAX = 4_000

EVIDENCE_KEYS = ("objective", "strategy", "transforms", "payload", "response", "reasoning",
                 "tool_calls", "judge", "conversation")


def evidence_detail(run_dir: Path, finding: Finding, strategy: str, *,
                    with_conversation: bool) -> dict | None:
    """One finding's evidence, picked field by field. Never the configuration or connection info."""
    evidence = read_evidence(run_dir, finding.evidence_id)
    if not evidence:
        return None
    objective = evidence.get("objective") if isinstance(evidence.get("objective"), dict) else {}
    judge = evidence.get("judge_result") if isinstance(evidence.get("judge_result"), dict) else {}
    tool_calls = [call for call in evidence.get("tool_calls") or [] if isinstance(call, dict)][:50]
    transforms = [item for item in evidence.get("transform_chain") or []
                  if isinstance(item, dict) and item.get("name")]
    return {
        "objective": {
            "title": label(objective.get("title"), MAX_TEXT),
            "category": label(objective.get("category"), 80),
            "success_criteria": body_text(objective.get("success_criteria"), 2_000),
        },
        "strategy": label(strategy, 80),
        "transforms": [label(item.get("name"), 80) for item in transforms][:30],
        "payload": body_text(evidence.get("payload"), EVIDENCE_TEXT_MAX),
        "response": body_text(evidence.get("target_response"), EVIDENCE_TEXT_MAX),
        "reasoning": body_text(evidence.get("target_reasoning"), EVIDENCE_TEXT_MAX),
        "tool_calls": [{"name": label(call.get("name"), 120),
                        "args": body_text(json.dumps(call.get("args") or {}, default=str), 4_000)}
                       for call in tool_calls],
        "judge": _judge_detail(judge),
        # multi-turn conversations count as transcripts, so they follow that setting
        "conversation": _conversation(evidence) if with_conversation else [],
    }


def _judge_detail(judge: dict) -> dict:
    signals = [signal for signal in judge.get("signals") or [] if isinstance(signal, dict)][:20]
    return {
        "outcome": label(judge.get("outcome"), 40),
        "score": bounded_int(judge.get("score"), 0, 10),
        "rationale": body_text(judge.get("rationale"), 4_000),
        "signals": [{"signal": label(signal.get("signal"), 60), "hit": bool(signal.get("hit")),
                     "score": rate(signal.get("score")),
                     "detail": body_text(signal.get("detail"), 1_000)}
                    for signal in signals],
    }


def _conversation(evidence: dict) -> list[dict]:
    turns = [turn for turn in evidence.get("attack_sequence") or [] if isinstance(turn, dict)][:100]
    return [{"role": label(turn.get("role"), 20),
             "text": body_text(turn.get("content", turn.get("text")), TRANSCRIPT_TEXT_MAX)}
            for turn in turns]
