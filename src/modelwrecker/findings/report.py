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
    """The run report: a summary, each finding, then every attempt's prompt and reply."""
    lines = [f"# modelWrecker report - run {run_id}", ""]
    if findings:
        lines.append(f"**{len(findings)} finding(s).**")
    else:
        lines.append("**No findings.** The target refused or the attacks did not hold on replay.")
    lines.append("")
    for finding in findings:
        lines += _finding_lines(finding)
    if attempts:
        lines += _transcript_lines(attempts)
    return "\n".join(lines)


def _finding_lines(finding: Finding) -> list[str]:
    tax = ", ".join(f"{t.framework}:{t.id} ({t.title})" for t in finding.taxonomy) or "none"
    return [
        f"## Finding: {finding.severity.value.upper()} - {finding.title}",
        "",
        f"- id: `{finding.id}`",
        f"- taxonomy: {tax}",
        f"- status: {finding.status.value}",
        "",
        finding.summary,
        "",
    ]


def _transcript_lines(attempts: list) -> list[str]:
    """What we sent and what the model replied, for every attempt, grouped by objective."""
    lines = ["## Attempt transcript", "",
             "Every attack attempt, what the model was sent, its reply, and the result.", ""]
    current_objective = None
    for attempt in attempts:
        fields = _attempt_fields(attempt)
        if fields["objective"] != current_objective:
            current_objective = fields["objective"]
            lines += [f"### Objective: {current_objective}", ""]
        lines += [
            f"**Strategy:** `{fields['strategy']}`  -  "
            f"**Result:** {_result_label(fields['outcome'])} (score {fields['score']}/10)",
            "",
            "_Prompt sent to the model:_",
            "```",
            _clip(fields["prompt_sent"]),
            "```",
            "_Model response:_",
            "```",
            _clip(fields["model_response"]),
            "```",
            "",
        ]
    return lines


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
