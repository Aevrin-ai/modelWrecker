"""Render analytics into static artifacts: JSON and CSV here, HTML in `render_html`."""

from __future__ import annotations

import csv
import io
import json

from .engine import Analytics, Breakdown, build_leaderboard
from .render_html import render_analytics_html as render_analytics_html
from .render_html import render_leaderboard_html as render_leaderboard_html


def _analytics_dict(a: Analytics) -> dict[str, object]:
    low, high = a.asr_ci
    return {
        "label": a.label,
        "total_attempts": a.total_attempts,
        "successes": a.successes,
        "partials": a.partials,
        "refusals": a.refusals,
        "errors": a.errors,
        "asr": round(a.asr, 4),
        "asr_ci_low": round(low, 4),
        "asr_ci_high": round(high, 4),
        "robustness": round(a.robustness, 4),
        "by_strategy": [_breakdown_dict(b) for b in a.by_strategy],
        "by_category": [_breakdown_dict(b) for b in a.by_category],
        "findings_total": a.findings_total,
        "findings_by_severity": a.findings_by_severity,
        "by_taxonomy": a.by_taxonomy,
    }


def _breakdown_dict(b: Breakdown) -> dict[str, object]:
    low, high = b.confidence_interval
    return {
        "key": b.key,
        "attempts": b.attempts,
        "successes": b.successes,
        "partials": b.partials,
        "asr": round(b.asr, 4),
        "asr_ci_low": round(low, 4),
        "asr_ci_high": round(high, 4),
    }


def render_analytics_json(a: Analytics) -> str:
    return json.dumps(_analytics_dict(a), ensure_ascii=False, indent=2)


def render_leaderboard_json(runs: list[Analytics]) -> str:
    rows = build_leaderboard(runs)
    return json.dumps(
        [
            {
                "rank": r.rank,
                "label": r.label,
                "asr": round(r.asr, 4),
                "asr_ci_low": round(r.ci_low, 4),
                "asr_ci_high": round(r.ci_high, 4),
                "robustness": round(r.robustness, 4),
                "total_attempts": r.total_attempts,
                "findings_total": r.findings_total,
                "high_severity": r.high_severity,
            }
            for r in rows
        ],
        ensure_ascii=False,
        indent=2,
    )


def render_analytics_csv(a: Analytics) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["dimension", "key", "attempts", "successes", "partials",
                     "asr", "ci_low", "ci_high"])
    low, high = a.asr_ci
    writer.writerow(["overall", a.label, a.total_attempts, a.successes, a.partials,
                     round(a.asr, 4), round(low, 4), round(high, 4)])
    for dimension, items in (("strategy", a.by_strategy), ("category", a.by_category)):
        for b in items:
            b_low, b_high = b.confidence_interval
            writer.writerow([dimension, b.key, b.attempts, b.successes, b.partials,
                             round(b.asr, 4), round(b_low, 4), round(b_high, 4)])
    return buf.getvalue()


def render_leaderboard_csv(runs: list[Analytics]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["rank", "label", "asr", "ci_low", "ci_high", "robustness",
                     "attempts", "findings", "high_severity"])
    for r in build_leaderboard(runs):
        writer.writerow([r.rank, r.label, round(r.asr, 4), round(r.ci_low, 4),
                         round(r.ci_high, 4), round(r.robustness, 4), r.total_attempts,
                         r.findings_total, r.high_severity])
    return buf.getvalue()
