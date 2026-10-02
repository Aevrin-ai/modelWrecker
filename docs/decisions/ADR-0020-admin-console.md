# ADR-0020 - Admin console: staff domain plus an authenticator, audited

- **Status:** Accepted
- **Date:** 2026-10-02

## Decision
Staff manage the platform at `app.aevrin.net/admin`, the dashboard build under another path. Access needs
a Google sign-in with a **verified email exactly on `aevrin.net`**, then a **TOTP authenticator code**,
which starts a short **admin session** stored only as a hash. The API checks all three on every admin
request. Every change needs a reason and is written to an append-only audit table. Page analytics are
**first-party and cookie-free**: one beacon per page view to our own API, with a daily salted visitor
hash and no IP address stored.

## Why
- The domain rule is what the maintainer asked for, and it is easy to reason about. A verified-email
  check plus an exact domain match stops look-alike addresses.
- A second factor that does not depend on Google limits the damage of a stolen Google session. TOTP works
  with every authenticator app, needs no SMS or paid service, and fits the "free, self-hostable" rule.
- One build keeps the look identical to the dashboard and needs no second deploy target; the admin code
  is a separate chunk that only loads under `/admin/`.
- First-party analytics keep visitor data out of third-party hands and avoid a consent banner.

## Alternatives
- **An allow-list of admin emails** - possible later as an extra check; the domain rule was requested.
- **Supabase Auth's built-in MFA** - would tie admin factors to the end-user auth settings; a separate,
  server-checked factor keeps the admin layer independent.
- **WebAuthn security keys** - stronger, but needs hardware for every admin; TOTP first, keys later.
- **A third-party analytics script** - rejected for privacy and to keep the page free of outside code.

## Trade-offs
- Anyone who controls an `aevrin.net` mailbox can create a Google account for it; the domain's mail must
  stay controlled. The authenticator is the backstop.
- Losing both the phone and the recovery codes needs a database edit by the domain owner (documented).
