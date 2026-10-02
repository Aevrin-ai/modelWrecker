# ADR-0019 - Prepaid plans through Razorpay Orders, confirmed on the server

- **Status:** Accepted
- **Date:** 2026-10-02
- **Refines:** [ADR-0016](ADR-0016-billing-razorpay.md) (Razorpay stays the provider)

## Decision
Pro is sold **prepaid, for one month or one year**, with a Razorpay **Order** per purchase. Nothing renews
automatically. A payment is applied only on the server, by a single database function that applies each
order exactly once, reached from three paths: the browser's verify call (signature checked with the key
secret **and** the payment fetched from Razorpay), the signed webhook, and reconciliation of recent unpaid
orders. Prices include 18 percent GST and keep a 30 to 40 percent margin under the cost model in
[`../billing/pricing.md`](../billing/pricing.md).

## Why
- Orders work on every Razorpay account. Auto-renewing Subscriptions need the feature enabled on the
  account and card or UPI mandates with extra rules, which adds failure modes before the product has
  paying users. Chosen by the maintainer.
- ADR-0016 named the webhook as the only source of truth. A webhook alone leaves the user waiting when it
  is late and needs manual setup. Fetching the payment from Razorpay's API is equally server-to-server and
  equally trustworthy, so it is added as a path, not a replacement. The browser's word is still never
  trusted on its own.
- One idempotent database function means the three paths cannot double-apply a payment.

## Alternatives
- **Razorpay Subscriptions (auto-renew)** - deferred. Revisit when there is demand for automatic renewal.
- **Webhook only** - rejected; see above.
- **Trust Checkout's success callback** - rejected, as in ADR-0016.

## Trade-offs
- Users must renew by hand. Mitigated with a renewal banner in the last 7 days and renewals that add to
  the current end date, so renewing early loses nothing.
