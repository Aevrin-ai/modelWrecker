# ADR-0026 - The engine is also published on its own, as Aevrin-ai/modelWrecker

- **Status:** Accepted
- **Date:** 2026-11-04

## Decision
- This repository (Aevrin-ai/Vyra) holds the whole product: the engine, the landing page, the dashboard,
  and the API. It is the one place any of it is developed.
- [Aevrin-ai/modelWrecker](https://github.com/Aevrin-ai/modelWrecker) carries only the engine, with the full
  history of every engine file. `.github/workflows/sync-engine.yml` rebuilds it with `git filter-repo` on
  every push to `main` and every `v*` tag, and pushes without `--force`.
- The product is named Vyra; the engine keeps the name modelWrecker (`pip install modelwrecker`, the
  `modelwrecker` command, its environment variables and config folders).
- Issues stay here. The engine repository has issues and the wiki turned off, and its pull request template
  points here.

## Why
- The dashboard's Connect page tells people to clone the engine to run it in Docker. With the apps in the
  same repository, that clone carried about 600 files of frontend and API code nobody running the engine
  needs.
- Two repositories edited by hand drift apart. A mirror rebuilt from one source cannot.
- `git filter-repo` gives the same commits for the same input, so the mirror keeps every engine commit's
  original author and date and only ever grows.
- PyPI already ships only the engine (`[tool.hatch.build]` in `pyproject.toml`), so nothing changes there.

## Trade-offs
- A commit in the mirror has a different hash from the same commit here.
- Changing the path list rewrites the mirror's history once (see `deploy/github/README.md`).
- The mirror pushes with a deploy key stored as the `ENGINE_DEPLOY_KEY` secret.

## References
- `deploy/github/README.md`, `deploy/github/engine-mirror.sh`
- ADR-0025, the apps and packages layout
