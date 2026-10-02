# ADR-0016 - Billing provider is Razorpay

- **Status:** Accepted; refined by [ADR-0019](ADR-0019-prepaid-billing.md) (prepaid orders, and payment
  confirmed by fetching it from Razorpay as well as by the webhook)
- **Date:** 2026-10-02

## Decision
Use **Razorpay** for billing, kept entirely in the cloud control plane. No Razorpay secret ever ships in
Docker, MCP, the CLI, or the engine. Payment success is decided only by a Razorpay webhook verified
server-side, never by a browser message. A verified payment updates the subscription, which produces a new
signed entitlement the local engine checks. Full flow: [`../billing/razorpay.md`](../billing/razorpay.md).

## Why
- Billing is a control-plane concern and must stay out of the compute plane, so a leaked engine or device
  never exposes a payment credential. This follows the boundary in
  [`ADR-0014`](ADR-0014-local-cloud-boundary.md).
- Server-side webhook verification (HMAC SHA256 over the raw body with the webhook secret) is the standard,
  safe way to confirm payment and resists a manipulated browser.
- Razorpay is the maintainer's chosen provider for this product.

## Alternatives
- **Trust a browser success callback** - rejected. The browser can be manipulated; only a verified webhook
  is trusted.
- **Put billing logic near the engine** - rejected. It would spread subscription checks into the attack
  code, which ADR-0018 forbids.

## Trade-offs
- The webhook path must handle duplicates and missed events (idempotency and reconciliation). Covered in
  [`../billing/razorpay.md`](../billing/razorpay.md).
- Ties the control plane to one provider. Mitigated because the engine only ever sees the resulting signed
  entitlement, so swapping providers does not touch the engine.
