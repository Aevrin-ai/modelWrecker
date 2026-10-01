# Analytics and leaderboards

**Status: implemented (Phase 8).** Lives in `src/modelwrecker/analytics/`. Produces **static artifacts
only** - a self-contained HTML report plus JSON and CSV. There is no server and no network listener; the
hosted dashboard that serves the same numbers live is Phase 10 (see `../../ROADMAP.md`).

**Purpose.** Turn runs into measured, comparable numbers: how often attacks succeed, where, and how sure
we are - and rank targets against each other.

## What it measures

- **ASR (attack success rate)** at the attempt level: successes / attempts.
- **Confidence intervals.** Every rate carries a **Wilson 95%** interval, not a bare fraction. Small N is
  the red-team norm, and Wilson stays honest at the edges: 5/5 does not collapse to a flat 100%, and 0/12
  still shows a real upper bound. Implemented once in `reliability/replay.py:wilson_interval` and reused
  here and in per-attack reliability (see [`RELIABILITY.md`](RELIABILITY.md)).
- **Breakdowns** by attack strategy and by objective category.
- **Findings** by severity and by taxonomy entry.
- **Robustness** = 1 - ASR (how often the target held).

## Leaderboard

`build_leaderboard` ranks one `Analytics` per target, **most-robust first** (lowest ASR first), with each
target's ASR, its confidence interval, total attempts, finding count, and high/critical count. A wide
interval means few attempts - the fix is more objectives, and the report says so rather than hiding it.

## Output

`modelwrecker analyze <run-dir> [<run-dir> ...]` reads each run's findings and attempt transcript and
writes, per run, `analytics-<run>.{html,json,csv}`. Given two or more runs it also writes
`leaderboard.{html,json,csv}`. `--out-dir` chooses where; `--format` selects the subset. See
[`../reference/CLI.md`](../reference/CLI.md).

The HTML is fully self-contained: inline CSS, CSS-only bars, no scripts, fonts, or external assets, so a
report opens offline and can be published as a single file.

## garak

The garak batch-scan adapter (ADR-0006) is part of this phase. garak supplies attack prompts (a large
probe corpus); our judge still decides success, so the attacker/target/judge split holds. It is behind the
`garak_probe` strategy and the optional `modelwrecker[scan]` dependency, registering only when garak is
importable. See [`STRATEGIES.md`](STRATEGIES.md) and [`../DEPENDENCIES.md`](../DEPENDENCIES.md).
