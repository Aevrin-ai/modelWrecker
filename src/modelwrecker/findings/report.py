"""Render findings and the full attempt transcript into reports (markdown and json).

The report shows, for every attempt: what we sent to the model, what the model replied, and whether
it was a success/partial/refusal. Findings get their own section with the exact payload and
response. All renderers read the same data, so they never disagree (see
docs/architecture/EVIDENCE-AND-FINDINGS.md).
"""

from __future__ import annotations

import json
from pathlib import Path

from ..data import Finding

_MAX = 800  # characters shown per prompt/response block before truncation


def _clip(text: str, limit: int = _MAX) -> str:
    text = text or ""
    if len(text) <= limit:
        return text
    return text[:limit] + f"\n... [truncated, {len(text)} chars total]"


def _attempt_fields(a: object) -> dict:
    """Normalize an attempt record (AttemptRecord dataclass or a dict from events.jsonl)."""
    if isinstance(a, dict):
        return {
            "objective": a.get("objective", ""),
            "strategy": a.get("strategy", ""),
            "prompt_sent": a.get("prompt_sent", a.get("payload", "")),
            "model_response": a.get("model_response", a.get("response", "")),
            "outcome": a.get("outcome", ""),
            "score": a.get("score", 0),
        }
    return {
        "objective": getattr(a, "objective", ""),
        "strategy": getattr(a, "strategy", ""),
        "prompt_sent": getattr(a, "prompt_sent", ""),
        "model_response": getattr(a, "model_response", ""),
        "outcome": getattr(a, "outcome", ""),
        "score": getattr(a, "score", 0),
    }


def _result_label(outcome: str) -> str:
    return {"success": "SUCCESS", "partial": "PARTIAL", "refused": "FAILED (refused)",
            "error": "ERROR"}.get(outcome, outcome.upper() or "UNKNOWN")


def render_markdown(findings: list[Finding], run_id: str, attempts: list | None = None) -> str:
    lines = [f"# modelWrecker report - run {run_id}", ""]

    # Summary.
    if findings:
        lines.append(f"**{len(findings)} finding(s).**")
    else:
        lines.append("**No findings.** The target refused or the attacks did not hold on replay.")
    lines.append("")

    # Findings, with the exact prompt and response.
    for f in findings:
        tax = ", ".join(f"{t.framework}:{t.id} ({t.title})" for t in f.taxonomy) or "none"
        lines += [
            f"## Finding: {f.severity.value.upper()} - {f.title}",
            "",
            f"- id: `{f.id}`",
            f"- taxonomy: {tax}",
            f"- status: {f.status.value}",
            "",
            f.summary,
            "",
        ]

    # Full attempt transcript: what we sent and what the model replied, for every attempt.
    if attempts:
        lines += ["## Attempt transcript", "",
                  "Every attack attempt, what the model was sent, its reply, and the result.", ""]
        current_objective = None
        for a in attempts:
            d = _attempt_fields(a)
            if d["objective"] != current_objective:
                current_objective = d["objective"]
                lines += [f"### Objective: {current_objective}", ""]
            lines += [
                f"**Strategy:** `{d['strategy']}`  -  **Result:** {_result_label(d['outcome'])} "
                f"(score {d['score']}/10)",
                "",
                "_Prompt sent to the model:_",
                "```",
                _clip(d["prompt_sent"]),
                "```",
                "_Model response:_",
                "```",
                _clip(d["model_response"]),
                "```",
                "",
            ]
    return "\n".join(lines)


def render_json(findings: list[Finding], run_id: str, attempts: list | None = None) -> str:
    return json.dumps(
        {
            "run_id": run_id,
            "findings": [f.model_dump(mode="json") for f in findings],
            "attempts": [_attempt_fields(a) for a in (attempts or [])],
        },
        ensure_ascii=False,
        indent=2,
    )


def load_run_meta(run_dir: str | Path) -> dict:
    """Read the run_meta event (target model/provider) from a run directory, if present."""
    d = Path(run_dir)
    events = d / "events.jsonl"
    if events.exists():
        for line in events.read_text(encoding="utf-8").splitlines():
            try:
                e = json.loads(line)
            except ValueError:
                continue
            if e.get("kind") == "run_meta":
                return e
    return {}


def load_run(run_dir: str | Path) -> tuple[list[Finding], list[dict]]:
    """Read findings and the attempt transcript from a finished run directory."""
    d = Path(run_dir)
    findings = [Finding.model_validate_json(fp.read_text(encoding="utf-8"))
                for fp in sorted(d.glob("finding-*.json"))]
    attempts: list[dict] = []
    events = d / "events.jsonl"
    if events.exists():
        for line in events.read_text(encoding="utf-8").splitlines():
            try:
                e = json.loads(line)
            except ValueError:
                continue
            if e.get("kind") == "attempt":
                attempts.append(e)
    return findings, attempts
