# ADR-0023 - Error handling and fault tolerance for the hosted service and the engine

- **Status:** Accepted
- **Date:** 2026-10-18

## Decision
- The control-plane API keeps its error shape and adds to it: `{ "error", "message", "requestId" }`, with
  the same id in an `X-Request-Id` header on every response. The id is Cloudflare's ray id when the
  header has the right shape, otherwise a fresh UUID.
- One error handler classifies every failure. A database failure is classified by its Postgres or
  PostgREST code, never by its message text: availability codes become `503 service_unavailable`, so
  clients retry; anything else stays a `500` whose message reveals nothing.
- Every outbound call has one time budget for all its attempts. Only GET and HEAD are retried, once,
  after a network failure, a `429`, or a `502`, `503`, or `504`, with exponential backoff, jitter, and a
  capped `Retry-After`. A POST is never retried.
- The API logs one redacted JSON line per event through a single module, with the request id, and
  Cloudflare Workers Logs keeps them.
- `GET /health/ready` checks the database; `GET /health` stays a liveness check.
- In the engine, a provider error says whether it is retryable. The campaign loop never retries a
  permanent one, adds jitter, and honors `Retry-After` up to 30 seconds.

## Why
- A request id is the only safe way to connect what a person saw to what the server knows, without
  sending internals to the client.
- Mapping database errors by message text breaks when the wording changes and can mislabel a bug as a
  client mistake. Codes are stable.
- A retry storm makes an outage worse, and repeating a POST can charge, refund, or revoke a session
  twice. Retrying only safe methods inside a fixed budget recovers from blips without either risk.
- Retrying a rejected key or a missing model spends time and provider quota and can never succeed.
- Logs outlive responses and are read more widely, so redaction has to happen in one place, before
  anything is written.

## Alternatives
- Change the error shape to `{ success, code, message, requestId }` - rejected: every installed CLI and
  the dashboard read `error` and `message`, so it would break them. The fields were added instead.
- Map common constraint violations (unique, foreign key) to `409` or `404` globally - rejected: the same
  code means different things in different routes. Routes that expect one translate it themselves.
- Retry POSTs with idempotency keys - not now: Razorpay's order and refund calls and Supabase's token
  endpoint do not give one guarantee across all of them. Reconciliation covers a lost answer instead.

## Trade-offs
- A GET can take up to the full budget (10 s for Supabase) before it fails, instead of failing at once.
- The device-polling replies keep their RFC 8628 shape without `requestId`; the header still has it.
- Persistent logs depend on Cloudflare Workers Logs and its limits for the account's plan.

## References
- [`../architecture/control-plane-api.md`](../architecture/control-plane-api.md#errors-timeouts-and-retries)
- [`../workflows/INCIDENT-RUNBOOK.md`](../workflows/INCIDENT-RUNBOOK.md)
- [`../campaigns/OVERVIEW.md`](../campaigns/OVERVIEW.md) (retry policy)
