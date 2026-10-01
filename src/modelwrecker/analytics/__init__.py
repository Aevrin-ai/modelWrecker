"""Analytics: turn runs into measured, comparable numbers (Phase 8).

Computes attack success rate (ASR) with confidence intervals, broken down by strategy and category,
plus a cross-run model leaderboard. Output is static artifacts only (HTML/JSON/CSV) - no server, no
network listener (that is Phase 10). See docs/attack-engine/ANALYTICS.md.
"""

from __future__ import annotations

from .engine import (
    Analytics,
    Breakdown,
    LeaderboardRow,
    build_leaderboard,
    compute_analytics,
)
from .render import (
    render_analytics_csv,
    render_analytics_html,
    render_analytics_json,
    render_leaderboard_csv,
    render_leaderboard_html,
    render_leaderboard_json,
)

__all__ = [
    "Analytics",
    "Breakdown",
    "LeaderboardRow",
    "build_leaderboard",
    "compute_analytics",
    "render_analytics_csv",
    "render_analytics_html",
    "render_analytics_json",
    "render_leaderboard_csv",
    "render_leaderboard_html",
    "render_leaderboard_json",
]
