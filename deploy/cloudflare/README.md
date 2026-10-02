# Cloudflare setup (hosting + DNS + auto-deploy)

Cloudflare Pages serves both apps on one domain; a GitHub Actions workflow redeploys on
every relevant commit. No secret is stored in the repo.

## 1. Create the Pages project

Create one Cloudflare Pages project named **modelwrecker-app** (Direct Upload / Wrangler, not a
Git integration, since the GitHub workflow pushes the built output).

```bash
# one-time, from your machine with Wrangler logged in:
npx wrangler pages project create modelwrecker-app --production-branch main
```

The workflow `.github/workflows/deploy-web.yml` builds `src/web` (landing) and `src/dash`
(dashboard), merges them (landing at `/`, dashboard at `/dashboard/`), copies
`deploy/cloudflare/pages/_worker.js` to the site root, and runs
`wrangler pages deploy ... --project-name=modelwrecker-app`.

Deep links: do not add a `_redirects` file. Pages applies `_redirects` rules before static files, so a
catch-all rewrite answers the JS and CSS requests with HTML and the page loads blank. The small
`_worker.js` sends dashboard page paths (no file extension) to `/dashboard/` and passes everything else to
the static files. Landing deep links use the Pages default single-page-app fallback.

## 2. Add the custom domain + DNS for app.aevrin.net

The maintainer asked: if an `app.aevrin.net` DNS record already exists, remove it and
recreate it. DNS is the one change that can break a live site, so confirm before running.

1. In Cloudflare dashboard: Pages -> modelwrecker-app -> Custom domains -> Set up a custom
   domain -> `app.aevrin.net`. Cloudflare creates the correct CNAME automatically.
2. If a conflicting existing record for `app` is present under the aevrin.net zone (DNS tab),
   delete it first, then let the custom-domain step create the new one.

Record that results (for reference):

```text
Type:   CNAME
Name:   app   (app.aevrin.net)
Target: modelwrecker-app.pages.dev
Proxy:  Proxied (orange cloud)
```

## 3. GitHub Actions secrets (enables auto-deploy)

Add these in GitHub -> Settings -> Secrets and variables -> Actions. They are never in the repo.

```text
CLOUDFLARE_API_TOKEN   = a token with the "Cloudflare Pages: Edit" permission
CLOUDFLARE_ACCOUNT_ID  = your Cloudflare account id
```

Also add the dashboard build-time env vars (Supabase public values) as Actions secrets or
repository variables so the build can read them:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

After this, any push to `main` touching `src/web/**` or `src/dash/**` redeploys app.aevrin.net.

## 4. Deploy the control-plane API Worker

The API (`src/api`) is a Cloudflare Worker served on the same domain at `app.aevrin.net/api/*`.

```bash
cd src/api
npm ci
npx wrangler deploy                                  # creates the Worker and its app.aevrin.net/api/* route
npx wrangler secret put SUPABASE_URL                 # paste each value when prompted; never commit them
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

The route is already set in `src/api/wrangler.toml` (the aevrin.net zone is on Cloudflare), so
`app.aevrin.net/api/*` reaches the Worker and everything else stays on Pages. Until the three secrets are
set the API answers `503 unavailable` rather than running half-configured. After that, the workflow
`.github/workflows/deploy-api.yml` redeploys the Worker on any push touching `src/api/**` (it runs the
typecheck and tests first). Give the `CLOUDFLARE_API_TOKEN` secret both "Workers Scripts: Edit" and
"Cloudflare Pages: Edit".

Also add two repository **variables** (not secrets; they are public) so the dashboard builds against the
real API: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## 5. Free-tier limits to respect

- Workers: 100,000 requests/day on the free plan. Keep the dashboard and landing static;
  use Workers only for the thin API/edge glue.
- Pages: static asset requests are free; builds/deploys have monthly caps on the free plan.
- Design for graceful failure when a quota is reached (see docs/deployment/cloudflare.md).
