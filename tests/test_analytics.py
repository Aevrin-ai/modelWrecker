"""Phase 8 analytics tests: Wilson intervals, ASR breakdowns, leaderboard, and static renderers.

Offline and deterministic. See docs/attack-engine/ANALYTICS.md.
"""

from __future__ import annotations

import csv
import io
import json

from modelwrecker.analytics import (
    build_leaderboard,
    compute_analytics,
    render_analytics_csv,
    render_analytics_html,
    render_analytics_json,
    render_leaderboard_csv,
    render_leaderboard_html,
    render_leaderboard_json,
)
from modelwrecker.data import Finding, Severity, TaxonomyRef
from modelwrecker.reliability.replay import wilson_interval


def _attempt(strategy, outcome, category="jailbreak", score=0):
    return {"strategy": strategy, "outcome": outcome, "category": category, "score": score}


def _finding(sev: Severity) -> Finding:
    return Finding(
        objective_id="o", attempt_id="a", severity=sev, title="t",
        taxonomy=[TaxonomyRef(framework="owasp_llm", id="LLM01", edition="2026", title="x")],
    )


# --- Wilson interval ---


def test_wilson_never_zero_width_at_extremes() -> None:
    low, high = wilson_interval(5, 5)
    assert low < 1.0 and high <= 1.0 and low > 0.0  # 5/5 still shows uncertainty, not a flat 1.0
    low0, high0 = wilson_interval(0, 5)
    assert low0 == 0.0 and high0 > 0.0
    assert wilson_interval(0, 0) == (0.0, 0.0)


def test_wilson_tightens_with_more_samples() -> None:
    narrow = wilson_interval(50, 100)
    wide = wilson_interval(5, 10)
    assert (narrow[1] - narrow[0]) < (wide[1] - wide[0])  # same 50% rate, more data = tighter


# --- compute_analytics ---


def test_compute_analytics_counts_and_breakdowns() -> None:
    attempts = [
        _attempt("direct_jailbreak", "success"),
        _attempt("direct_jailbreak", "refused"),
        _attempt("prefill", "success", category="extraction"),
        _attempt("prefill", "partial", category="extraction"),
        _attempt("prefill", "refused", category="extraction"),
    ]
    findings = [_finding(Severity.CRITICAL), _finding(Severity.HIGH)]
    a = compute_analytics(findings, attempts, label="gpt-test")

    assert a.total_attempts == 5
    assert a.successes == 2
    assert a.partials == 1
    assert a.refusals == 2
    assert abs(a.asr - 0.4) < 1e-9
    assert a.robustness == 1 - a.asr

    by_strat = {b.key: b for b in a.by_strategy}
    assert by_strat["direct_jailbreak"].attempts == 2
    assert by_strat["direct_jailbreak"].successes == 1
    assert by_strat["prefill"].successes == 1

    by_cat = {b.key: b for b in a.by_category}
    assert by_cat["extraction"].attempts == 3
    assert a.findings_total == 2
    assert a.findings_by_severity == {"critical": 1, "high": 1}
    assert a.by_taxonomy == {"owasp_llm:LLM01": 2}


def test_compute_analytics_empty_run() -> None:
    a = compute_analytics([], [], label="empty")
    assert a.total_attempts == 0
    assert a.asr == 0.0
    assert a.by_strategy == []


# --- leaderboard ---


def test_leaderboard_ranks_most_robust_first() -> None:
    weak = compute_analytics(
        [_finding(Severity.CRITICAL)],
        [_attempt("direct_jailbreak", "success")] * 8
        + [_attempt("direct_jailbreak", "refused")] * 2,
        label="weak-model",
    )
    strong = compute_analytics(
        [], [_attempt("direct_jailbreak", "refused")] * 10, label="strong-model"
    )
    rows = build_leaderboard([weak, strong])
    assert rows[0].label == "strong-model"  # lowest ASR ranks first
    assert rows[0].rank == 1
    assert rows[1].label == "weak-model"
    assert rows[1].high_severity == 1


# --- renderers (static artifacts) ---


def test_json_renderer_is_valid_and_complete() -> None:
    a = compute_analytics([_finding(Severity.HIGH)], [_attempt("direct_jailbreak", "success")], "m")
    data = json.loads(render_analytics_json(a))
    assert data["label"] == "m"
    assert data["asr"] == 1.0
    assert data["asr_ci_low"] < 1.0  # interval present and honest
    assert data["findings_by_severity"] == {"high": 1}


def test_csv_renderer_parses() -> None:
    a = compute_analytics([], [_attempt("direct_jailbreak", "success"),
                               _attempt("prefill", "refused", category="extraction")], "m")
    rows = list(csv.DictReader(io.StringIO(render_analytics_csv(a))))
    dims = {r["dimension"] for r in rows}
    assert {"overall", "strategy", "category"} <= dims


def test_html_is_self_contained() -> None:
    a = compute_analytics(
        [_finding(Severity.CRITICAL)], [_attempt("direct_jailbreak", "success")], "m"
    )
    page = render_analytics_html(a)
    assert page.startswith("<!doctype html>")
    assert "modelWrecker analytics" in page
    # Self-contained: no external scripts/styles/fonts to fetch.
    for bad in ("http://", "https://", "<script", "src="):
        assert bad not in page
    assert "100%" in page  # the ASR bar/number rendered


def test_leaderboard_renderers() -> None:
    runs = [
        compute_analytics([], [_attempt("direct_jailbreak", "refused")] * 5, "safe"),
        compute_analytics([_finding(Severity.HIGH)],
                          [_attempt("direct_jailbreak", "success")] * 5, "weak"),
    ]
    assert json.loads(render_leaderboard_json(runs))[0]["label"] == "safe"
    assert "safe" in render_leaderboard_csv(runs)
    page = render_leaderboard_html(runs)
    assert page.startswith("<!doctype html>")
    assert "https://" not in page and "<script" not in page
