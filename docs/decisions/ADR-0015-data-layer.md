# ADR-0015 - Cloud data layer

- **Status:** Accepted
- **Date:** 2026-10-02
- **Confirmed by the maintainer:** 2026-10-02

## Decision
Use **Supabase Postgres with row-level security** for the control-plane data layer, **Cloudflare Pages**
for static hosting (dashboard and landing), and **Cloudflare Workers** only for the thin API and edge
glue. Row-level security is a database rule that limits each row to its owner, so one account cannot read
another's rows even if the API has a bug.

The maintainer confirmed this reconciliation on 2026-10-02, choosing it over the all-Cloudflare
alternative below.

## Why
- Local memory and the provided project key name Supabase (project modelWrecker, Postgres with RLS), which
  is a managed Postgres with auth and RLS built in, reducing maintenance.
- WORKFLOW.md sections 7 and 29 push Cloudflare D1, KV, and R2 to keep cost near zero.
- The recommended reconciliation keeps the cheapest fit for each job: static hosting and the request-path
  glue on Cloudflare, the relational data and per-row isolation on Supabase Postgres.

## Alternatives
- **All Cloudflare (D1 for data, KV, R2)** - lowest cost, but D1 free-tier daily row caps now fail hard
  past the limit, and the relational and RLS story is weaker than Postgres for multi-tenant isolation. See
  the limits in [`../deployment/cloudflare.md`](../deployment/cloudflare.md).
- **All Supabase (including hosting)** - fewer moving parts, but loses Cloudflare Pages' free static
  hosting and edge reach, and Supabase pauses idle free projects.

## Trade-offs
- Two providers to operate instead of one. Mitigated by keeping Workers thin and the data layer behind the
  API, so a later switch does not touch the local engine (the boundary in
  [`ADR-0014`](ADR-0014-local-cloud-boundary.md)).
- Free-tier caps on both sides must be designed around with graceful failure. See
  [`../deployment/cloudflare.md`](../deployment/cloudflare.md).

## Resolution
Confirmed by the maintainer on 2026-10-02: Supabase Postgres with RLS is the data layer, with Cloudflare
Pages and Workers for hosting and edge glue. The staged schema and RLS policies are in
`deploy/supabase/migrations/0001_init.sql`.
