"""Render findings into reports (markdown and json). SARIF/HTML come later.

All renderers read the same findings, so they never disagree (see docs/architecture/EVIDENCE-AND-FINDINGS.md).
"""

from __future__ import annotations

import json

from ..data import Finding


def render_markdown(findings: list[Finding], run_id: str) -> str:
    lines = [f"# modelWrecker report - run {run_id}", ""]
    if not findings:
        lines.append("No findings. The target refused or the attacks did not hold on replay.")
        return "\n".join(lines)
    lines.append(f"{len(findings)} finding(s).")
    lines.append("")
    for f in findings:
        tax = ", ".join(f"{t.framework}:{t.id} ({t.title})" for t in f.taxonomy) or "none"
        lines += [
            f"## {f.severity.value.upper()} - {f.title}",
            "",
            f"- id: `{f.id}`",
            f"- taxonomy: {tax}",
            f"- status: {f.status.value}",
            "",
            f.summary,
            "",
        ]
    return "\n".join(lines)


def render_json(findings: list[Finding], run_id: str) -> str:
    return json.dumps(
        {"run_id": run_id, "findings": [f.model_dump(mode="json") for f in findings]},
        ensure_ascii=False,
        indent=2,
    )
