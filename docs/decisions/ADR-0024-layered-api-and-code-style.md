# ADR-0024 - A layered control-plane API, and the owner's code style across the repository

- **Status:** Accepted
- **Date:** 2026-10-18

## Decision
- The control-plane API (`src/api/src`) is organized in layers: `middleware/`, `routes/` (route tables
  only), `controllers/` (request handlers), `validators/`, `services/` (business rules and platform
  modules), `database/`, `lib/`, `types/`, and `config/`. Only `index.ts` (the Worker entry), `app.ts` (the
  pipeline), and `container.ts` (the composition root) sit at the top. See
  [`../architecture/control-plane-api.md`](../architecture/control-plane-api.md#code-layout).
- The whole repository follows the owner's code style system: files under 300 lines, functions under the
  hard limit, no `any`, no empty or silent catch, no literal that looks like a real credential, one-line
  comments that say why, and clear names. The owner's style checker reports no errors anywhere.
- Large modules are split by responsibility. Every split keeps the old import path working (a re-export or
  a barrel), so callers, the CLI entry point (`modelwrecker.cli:app`), and test seams did not change.

## Why
- One flat folder of 18 modules made it hard to see where a change belongs. Layers give every file one job
  and one place.
- Small modules are easier to read, review, and test, which is the owner's main rule.
- Keeping import paths stable made the change a pure refactor: the same tests pass with the same results,
  the CLI help output is byte-identical, and the landing page prerenders to the same HTML.

## Exceptions kept on purpose
- Python dunder methods (`__init__`, `__repr__`) keep their names, which the checker flags as not snake_case.
- shadcn's lowercase primitives in `src/dash/src/components/ui/`, and its compound primitives that share
  private context in one file, follow shadcn's convention.
- The landing app keeps its kebab-case file names, its own consistent convention.
- Hono's `c` context parameter and the class-name helper `cn` keep their framework names.
- The logger is the one module that calls `console`.

## Trade-offs
- Some controllers still read and write through the `Database` interface for one-step operations instead
  of calling a service. A repository layer with one function per query is a possible next step; it was
  left out to keep this change a behavior-preserving move.
- More, smaller files. The JavaScript bundles grew by about 1 KB from the extra module structure.

## References
- The owner's code style system (ProfileBox `code-style-system`): `SYSTEM.md`, `profile/ARCHITECTURE.md`
- [`ADR-0023-error-handling.md`](ADR-0023-error-handling.md)
