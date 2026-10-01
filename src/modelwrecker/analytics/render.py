"""Render analytics into static artifacts: JSON, CSV, and a self-contained HTML page.

The HTML has no external scripts, fonts, or stylesheets - everything is inline, so a report opens
offline and can be published as a single file. Bars are plain CSS (no JavaScript). See the no-server
rule in docs/attack-engine/ANALYTICS.md.
"""

from __future__ import annotations

import csv
import html
import io
import json

from .engine import Analytics, Breakdown, build_leaderboard


def _pct(x: float) -> str:
    return f"{x * 100:.0f}%"


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
    low, high = b.ci
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
    w = csv.writer(buf)
    w.writerow(["dimension", "key", "attempts", "successes", "partials",
                "asr", "ci_low", "ci_high"])
    low, high = a.asr_ci
    w.writerow(["overall", a.label, a.total_attempts, a.successes, a.partials,
                round(a.asr, 4), round(low, 4), round(high, 4)])
    for b in a.by_strategy:
        bl, bh = b.ci
        w.writerow(["strategy", b.key, b.attempts, b.successes, b.partials,
                    round(b.asr, 4), round(bl, 4), round(bh, 4)])
    for b in a.by_category:
        bl, bh = b.ci
        w.writerow(["category", b.key, b.attempts, b.successes, b.partials,
                    round(b.asr, 4), round(bl, 4), round(bh, 4)])
    return buf.getvalue()


def render_leaderboard_csv(runs: list[Analytics]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["rank", "label", "asr", "ci_low", "ci_high", "robustness",
                "attempts", "findings", "high_severity"])
    for r in build_leaderboard(runs):
        w.writerow([r.rank, r.label, round(r.asr, 4), round(r.ci_low, 4), round(r.ci_high, 4),
                    round(r.robustness, 4), r.total_attempts, r.findings_total, r.high_severity])
    return buf.getvalue()


# --- HTML (self-contained) ---------------------------------------------------------------------

_STYLE = """
:root { --bg:#ffffff; --fg:#1a1a2e; --muted:#5a5a72; --line:#e3e3ef; --card:#f7f7fb;
        --bar:#4b5bd6; --bar-bg:#e3e3ef; --crit:#c0334e; --high:#d9772b; --ok:#2e9e6b; }
@media (prefers-color-scheme: dark) {
  :root { --bg:#14141c; --fg:#ececf2; --muted:#a0a0b8; --line:#2a2a3a; --card:#1c1c28;
          --bar:#7d8bf0; --bar-bg:#2a2a3a; --crit:#f0718a; --high:#f0a35a; --ok:#5fd6a0; } }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); margin: 0;
       font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5; }
.wrap { max-width: 920px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { font-size: 1.5rem; margin: 0 0 4px; } h2 { font-size: 1.1rem; margin: 32px 0 12px; }
.sub { color: var(--muted); margin: 0 0 24px; font-size: .9rem; }
.cards { display: flex; flex-wrap: wrap; gap: 12px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px;
        padding: 14px 16px; flex: 1 1 140px; }
.card .n { font-size: 1.6rem; font-weight: 650; }
.card .l { color: var(--muted); font-size: .8rem; }
table { border-collapse: collapse; width: 100%; font-size: .9rem; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line);
         vertical-align: middle; }
th { color: var(--muted); font-weight: 600; }
.bar { background: var(--bar-bg); border-radius: 5px; height: 10px; width: 100%; overflow: hidden; }
.bar > span { display: block; height: 100%; background: var(--bar); }
.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
.pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: .78rem; }
.sev-critical { background: var(--crit); color: #fff; }
.sev-high { background: var(--high); color: #fff; }
.note { color: var(--muted); font-size: .82rem; margin-top: 8px; }
.rank { font-weight: 650; color: var(--muted); }
""".strip()


def _page(title: str, body: str) -> str:
    return (
        "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
        f"<title>{html.escape(title)}</title>\n<style>{_STYLE}</style>\n</head>\n"
        f"<body>\n<div class=\"wrap\">\n{body}\n</div>\n</body>\n</html>\n"
    )


def _bar(value: float) -> str:
    w = max(0.0, min(1.0, value)) * 100
    return f'<div class="bar"><span style="width:{w:.1f}%"></span></div>'


def _breakdown_rows(items: list[Breakdown]) -> str:
    if not items:
        return '<tr><td colspan="4" class="note">No attempts recorded.</td></tr>'
    rows = []
    for b in items:
        low, high = b.ci
        rows.append(
            "<tr>"
            f"<td>{html.escape(b.key)}</td>"
            f'<td class="num">{b.successes}/{b.attempts}</td>'
            f'<td style="width:40%">{_bar(b.asr)}</td>'
            f'<td class="num">{_pct(b.asr)} '
            f'<span class="note">({_pct(low)}-{_pct(high)})</span></td>'
            "</tr>"
        )
    return "\n".join(rows)


def render_analytics_html(a: Analytics) -> str:
    low, high = a.asr_ci
    cards = [
        ("ASR", _pct(a.asr)),
        ("95% CI", f"{_pct(low)} - {_pct(high)}"),
        ("Attempts", str(a.total_attempts)),
        ("Successes", str(a.successes)),
        ("Findings", str(a.findings_total)),
    ]
    cards_html = "".join(
        f'<div class="card"><div class="n">{html.escape(v)}</div>'
        f'<div class="l">{html.escape(lbl)}</div></div>'
        for lbl, v in cards
    )
    sev_order = ["critical", "high", "medium", "low", "info"]
    sev_rows = [
        f"<tr><td>{s}</td><td class='num'>{a.findings_by_severity.get(s, 0)}</td></tr>"
        for s in sev_order if a.findings_by_severity.get(s, 0)
    ] or ["<tr><td colspan='2' class='note'>No findings.</td></tr>"]
    tax_rows = [
        f"<tr><td>{html.escape(k)}</td><td class='num'>{v}</td></tr>"
        for k, v in sorted(a.by_taxonomy.items(), key=lambda kv: (-kv[1], kv[0]))
    ] or ["<tr><td colspan='2' class='note'>No taxonomy mappings.</td></tr>"]

    body = f"""
<h1>modelWrecker analytics</h1>
<p class="sub">Target: {html.escape(a.label)}. Attack success rate and breakdowns.</p>
<div class="cards">{cards_html}</div>

<h2>ASR by strategy</h2>
<table><thead><tr><th>Strategy</th><th>Hits</th><th>Rate</th><th>ASR (95% CI)</th></tr></thead>
<tbody>{_breakdown_rows(a.by_strategy)}</tbody></table>

<h2>ASR by objective category</h2>
<table><thead><tr><th>Category</th><th>Hits</th><th>Rate</th><th>ASR (95% CI)</th></tr></thead>
<tbody>{_breakdown_rows(a.by_category)}</tbody></table>

<h2>Findings by severity</h2>
<table><thead><tr><th>Severity</th><th>Count</th></tr></thead><tbody>{''.join(sev_rows)}</tbody></table>

<h2>Findings by taxonomy</h2>
<table><thead><tr><th>Entry</th><th>Count</th></tr></thead><tbody>{''.join(tax_rows)}</tbody></table>

<p class="note">ASR = successes / attempts, at the attempt level. Intervals are Wilson 95%; small
samples stay honestly wide.</p>
""".strip()
    return _page(f"modelWrecker analytics - {a.label}", body)


def render_leaderboard_html(runs: list[Analytics]) -> str:
    rows = build_leaderboard(runs)
    trs = []
    for r in rows:
        trs.append(
            "<tr>"
            f'<td class="rank">#{r.rank}</td>'
            f"<td>{html.escape(r.label)}</td>"
            f'<td style="width:30%">{_bar(r.robustness)}</td>'
            f'<td class="num">{_pct(r.robustness)}</td>'
            f'<td class="num">{_pct(r.asr)} '
            f'<span class="note">({_pct(r.ci_low)}-{_pct(r.ci_high)})</span></td>'
            f'<td class="num">{r.total_attempts}</td>'
            f'<td class="num">{r.findings_total}</td>'
            f'<td class="num">{r.high_severity}</td>'
            "</tr>"
        )
    body = f"""
<h1>modelWrecker leaderboard</h1>
<p class="sub">Targets ranked most-robust first (lowest attack success rate). Static report.</p>
<table><thead><tr><th>Rank</th><th>Target</th><th>Robustness</th><th></th>
<th>ASR (95% CI)</th><th>Attempts</th><th>Findings</th><th>High/Crit</th></tr></thead>
<tbody>{''.join(trs)}</tbody></table>
<p class="note">Robustness = 1 - ASR. Intervals are Wilson 95%. A wide interval means few attempts;
run more objectives for a tighter estimate.</p>
""".strip()
    return _page("modelWrecker leaderboard", body)
