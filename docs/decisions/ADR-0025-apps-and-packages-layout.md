# ADR-0025 - Apps in apps/, shared code in packages/, the engine alone in src/

- **Status:** Accepted
- **Date:** 2026-11-04

## Decision
- The three TypeScript apps live in `apps/`: `apps/api` (the control-plane API Worker), `apps/web` (the
  landing page), and `apps/dashboard` (the dashboard). The code they share (plans, prices, and the page-view
  beacon) lives in `packages/shared`.
- `src/` holds only the Python engine (`src/modelwrecker`), the standard Python `src` layout.
  `pyproject.toml`, `tests/`, the Dockerfile, and PyPI publishing stay where they were.
- Each app keeps its own `package.json` and lockfile, with no workspace tool. The apps import the shared
  code by relative path, as before.

## Why
- `src/` mixed one Python package with three separately deployed Node apps, so the tree did not show what
  ships where. `apps/` and `packages/` is the layout most monorepos use.
- The Python package, its tests, and its build config did not need to move, so the PyPI and Docker builds
  are untouched.

## How it was checked
- The landing page, the dashboard, and the API Worker were built from `main` before the move and from the
  branch after it. The `main` build reproduces the hashed file names the live site serves. After the move
  the dashboard is byte-identical, and the landing page and the API Worker differ only in the text of the
  `$comment` in `packages/shared/plans.json`, which names the new paths. The dashboard and API tests pass
  and the API typecheck is clean.

## Trade-offs
- Older CHANGELOG entries and applied database migrations keep the old `src/...` paths, since they record
  what was true then.
- Open branches that touch the apps, such as `feat/55-landing-rebuild`, need a rebase onto the new paths.
  Git follows the renames.

## References
- ADR-0024, the layered control-plane API
