# ADR-0014 - Local and cloud boundary

- **Status:** Accepted
- **Date:** 2026-10-02

## Decision
modelWrecker is a local-first product. All heavy red-team work runs on the user's machine inside Docker:
attack generation, model inference, payload mutation, the attack loop, judging, reliability replay,
evidence, and campaign execution. The Aevrin cloud is a thin control plane only: identity, projects,
devices, entitlements, billing, analytics, and the dashboard. The cloud never runs attacks, never calls a
model, and never becomes a hidden compute dependency.

One engine serves many front doors (CLI, Docker, MCP, and a future REST API). There is never a separate
per-interface engine. The product boundary:

```text
Aevrin cloud  = identity + control + billing + analytics + policy
User's Docker = computation + red teaming + attack engine + MCP + evidence
```

Full map: [`../architecture/local-cloud.md`](../architecture/local-cloud.md).

## Why
- Users test private prompts, system prompts, source code, documents, credentials, and proprietary agent
  behavior. Keeping heavy work and sensitive content on the user's machine is the strongest privacy
  posture. See [`../architecture/data-flow.md`](../architecture/data-flow.md).
- It keeps the cloud cheap to operate: a thin control plane fits free tiers. See
  [`../deployment/cloudflare.md`](../deployment/cloudflare.md).
- It matches the project's core rules: self-hostable with free parts, provider layer replaceable, one
  engine behind interfaces. See [`../../CLAUDE.md`](../../CLAUDE.md).

## Alternatives
- **Cloud-hosted attack engine** - rejected. It would send sensitive customer data to the cloud, raise
  operating cost, and break the self-hostable requirement.
- **Hybrid where the cloud runs some attacks** - rejected. It creates a hidden compute dependency and
  blurs the boundary the product depends on.

## Trade-offs
- Syncing results and enforcing plan limits across the boundary needs careful design (signed entitlements,
  scoped device tokens, metadata-only sync). Those are handled in ADR-0016 through ADR-0018 and the Phase
  10 security docs.
