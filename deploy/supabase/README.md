# Supabase setup (data layer)

Use the existing Supabase project named **modelWrecker**. This is the control-plane data
layer with Row-Level Security. No secret values are stored in the repo.

## Apply the schema

Option A - SQL editor (simplest):

1. Open the modelWrecker project in the Supabase dashboard.
2. Open the SQL editor.
3. Run each migration in order: paste `deploy/supabase/migrations/0001_init.sql` and run it, then
   `0002_devices_and_sync.sql`. Both are safe to re-run.

Option B - Supabase CLI:

```bash
supabase link --project-ref <SUPABASE_PROJECT_REF>
supabase db push
```

## Enable Google sign-in in Supabase

1. In the Supabase dashboard: Authentication -> Providers -> Google -> enable.
2. Paste the Google OAuth Client ID and Client Secret from `deploy/google/README.md`.
3. Authentication -> URL Configuration:
   - Site URL: `https://app.aevrin.net`
   - Additional redirect URLs:
     - `https://app.aevrin.net/dashboard/`
     - `http://localhost:5173/`  (landing dev)
     - `http://localhost:5174/dashboard/`  (dashboard dev; the sign-in returns to `<origin>/dashboard/`)

## What the frontends need (public, safe to expose)

The dashboard build uses the project URL and the anon key (both are public client values;
RLS is what protects data). Provide them as build-time env vars, kept in your local
untracked env file and in GitHub Actions / Cloudflare, never in the repo:

```text
VITE_SUPABASE_URL=https://<SUPABASE_PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

The **service role key** is server-only (Workers API). Never put it in a frontend or in
the repo.

## What the API Worker needs

The control-plane API (`src/api`) uses three values from this project. All three are set as Worker
secrets, so nothing project-specific is written into this public repo (the third one is the server key and
must never leave the Worker):

```text
npx wrangler secret put SUPABASE_URL                 (run inside src/api)
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

## Notes

- The schema in `0001_init.sql` is a first draft. Reconcile it with
  `docs/architecture/cloud-control-plane.md` and `docs/architecture/DATA-MODEL.md` before
  treating it as final.
- Detailed evidence and transcripts are not stored here by default. Only synced metadata is.
