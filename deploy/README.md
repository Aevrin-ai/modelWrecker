# Deploy and setup runbook (Phase 10)

This folder holds the staged configuration and the exact manual steps to stand up the
Aevrin cloud control plane. Nothing here runs automatically and nothing here contains a
secret. You run the live steps when you are ready.

Architecture reminder (see [`docs/architecture/local-cloud.md`](../docs/architecture/local-cloud.md) and [`docs/architecture/`](../docs/architecture/OVERVIEW.md)):

- The Aevrin cloud is a thin control plane: identity, projects, devices, entitlements,
  billing, analytics, and the dashboard. It never runs attacks.
- Heavy red-team computation runs locally in Docker on the user's machine.
- Data layer: Supabase Postgres with Row-Level Security. Hosting: Cloudflare Pages
  (static landing + dashboard) plus minimal Workers for API/edge glue. Billing: Razorpay
  (cloud only).

Secrets live only in your local untracked credential store and in each platform's own
secret manager (GitHub Actions secrets, Cloudflare, Supabase). Never commit them.

## One domain, two apps

- Landing page (marketing): `https://app.aevrin.net/` - source in `src/web/`.
- Dashboard (product): `https://app.aevrin.net/dashboard/` - source in `src/dash/`.

Both are built and deployed together to a single Cloudflare Pages project by
`.github/workflows/deploy-web.yml` on every push that touches `src/web/**` or `src/dash/**`.

## Live setup order

1. Supabase - `deploy/supabase/README.md`
2. Google sign-in - `deploy/google/README.md`
3. Cloudflare Pages + DNS for app.aevrin.net - `deploy/cloudflare/README.md`
4. GitHub Actions secrets (for auto-deploy) - `deploy/cloudflare/README.md`
5. PyPI publishing - `deploy/pypi/README.md`

Each step is self-contained and reversible except DNS and the first PyPI publish, which
are called out explicitly so you can confirm before running them.
