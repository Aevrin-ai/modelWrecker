# ADR-0021 - Dashboard refresh token in an HttpOnly cookie, through the API

- **Status:** Accepted
- **Date:** 2026-10-11

## Decision
Supabase Auth keeps issuing, rotating, and checking the dashboard's tokens. The browser no longer talks to
Supabase Auth's token endpoints itself: the control-plane API exchanges the Google sign-in code, refreshes,
and signs out for it (`POST /api/v1/auth/session`, `/refresh`, `/logout`). The refresh token lives only in
an `HttpOnly`, `Secure`, `SameSite=Strict` cookie scoped to `/api/v1/auth`; the access token lives only in
the page's memory. Every other route still takes `Authorization: Bearer`, never a cookie. Every HTML page
also gets a Content-Security-Policy.

## Why
- A refresh token in `localStorage` can be read and carried off by any script that runs on the page. In an
  `HttpOnly` cookie it cannot; an injected script could only use the session while the page is open.
- Keeping Supabase Auth avoids a second token system: rotation, reuse detection, and revocation stay where
  they were tested.
- The API already runs on the same origin, so no new service, domain, or CORS setup is needed.

## Alternatives
- **Keep the Supabase client's `localStorage` session** - simplest, but leaves the long-lived credential
  readable by script.
- **Our own JWTs and refresh tokens** - a second auth system next to Supabase Auth, with its own signing
  keys and session store to secure.
- **Cookies for every API route** - would make every route a cross-site request forgery target; only the
  three auth routes read the cookie, and they need a custom header plus a same-origin check.

## Trade-offs
- Token refreshes now reach Supabase Auth from the Worker's address, so Supabase's per-address refresh
  limit is shared by all users; it is raised (`deploy/supabase/auth-settings.mjs`) and the API keeps its own
  per-visitor limit.
- A page load costs one refresh call, because the access token is not stored anywhere.
- The API must be on the same origin as the dashboard for the cookie to reach it.
