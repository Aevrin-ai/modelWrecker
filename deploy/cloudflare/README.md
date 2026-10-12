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

## 2. Custom domains: vyra.aevrin.ai (primary) and app.aevrin.net (redirect)

The browser app is served at **vyra.aevrin.ai**. **app.aevrin.net** stays alive: its page loads
301-redirect to vyra.aevrin.ai, but `app.aevrin.net/api/*` keeps serving the API Worker so already
installed `modelwrecker` CLI clients (which default to app.aevrin.net) do not break.

1. Pages -> modelwrecker-app -> Custom domains -> add `vyra.aevrin.ai`. Cloudflare creates the CNAME in
   the aevrin.ai zone automatically.
2. Keep `app.aevrin.net` attached as a custom domain too (the redirect below, not the Pages content,
   is what app.aevrin.net visitors see for page loads).
3. Redirect rule (Rules -> Redirect Rules on the aevrin.net zone), so browsers move to the new domain
   while the CLI keeps reaching the API:

```text
When:  (http.host eq "app.aevrin.net" and not starts_with(http.request.uri.path, "/api/"))
Then:  Static/Dynamic redirect to  concat("https://vyra.aevrin.ai", http.request.uri.path)
       preserve query string, status 301
```

Records for reference:

```text
CNAME  vyra  (vyra.aevrin.ai)  ->  modelwrecker-app.pages.dev   Proxied
CNAME  app   (app.aevrin.net)  ->  modelwrecker-app.pages.dev   Proxied   (page loads 301 to vyra; /api/* stays on the Worker)
```

## 3. GitHub Actions secrets (enables auto-deploy)

Add these in GitHub -> Settings -> Secrets and variables -> Actions. They are never in the repo.

```text
CLOUDFLARE_API_TOKEN   = a token with the "Cloudflare Pages: Edit" permission
CLOUDFLARE_ACCOUNT_ID  = your Cloudflare account id
```

Also add the dashboard's build-time value (the public Supabase project URL, where Google sign-in starts)
as a repository variable so the build can read it:

```text
VITE_SUPABASE_URL
```

After this, any push to `main` touching `src/web/**` or `src/dash/**` redeploys the site on vyra.aevrin.ai.

## 4. Deploy the control-plane API Worker

The API (`src/api`) is a Cloudflare Worker served at `vyra.aevrin.ai/api/*` (the browser app's origin) and
still at `app.aevrin.net/api/*` (for installed CLI clients). Both routes are in `src/api/wrangler.toml`.

```bash
cd src/api
npm ci
npx wrangler deploy                                  # creates the Worker and its vyra.aevrin.ai/api/* + app.aevrin.net/api/* routes
npx wrangler secret put SUPABASE_URL                 # paste each value when prompted; never commit them
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Optional groups; each feature stays off safely until its secrets are set:
npx wrangler secret put RAZORPAY_KEY_ID              # billing (docs/billing/razorpay.md)
npx wrangler secret put RAZORPAY_KEY_SECRET
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET      # the same value goes into the Razorpay webhook
npx wrangler secret put ENTITLEMENT_SIGNING_KEY      # Ed25519 PKCS#8 base64 (docs/security/entitlements.md)
npx wrangler secret put ADMIN_TOTP_KEY               # 32 random bytes, base64 (docs/security/admin.md)
npx wrangler secret put ANALYTICS_SALT               # random string (docs/analytics/page-analytics.md)
```

The entitlement key id and public key are plain vars in `src/api/wrangler.toml`; the engine ships the same
public key. Keep an offline copy of every generated secret in your own secret store: a lost signing key
means a key rotation, and a lost `ADMIN_TOTP_KEY` means every admin enrolls their authenticator again.

Both routes are set in `src/api/wrangler.toml` (the aevrin.ai and aevrin.net zones are on Cloudflare), so
`vyra.aevrin.ai/api/*` and `app.aevrin.net/api/*` reach the Worker and everything else stays on Pages.
`APP_ORIGIN` is `https://vyra.aevrin.ai` (the browser origin), while `ENTITLEMENT_ISSUER` stays
`https://app.aevrin.net` so every shipped engine keeps trusting the entitlements the Worker signs. Until
the three secrets are set the API answers `503 unavailable` rather than running half-configured. After
that, the workflow `.github/workflows/deploy-api.yml` redeploys the Worker on any push touching
`src/api/**` (it runs the typecheck and tests first). Give the `CLOUDFLARE_API_TOKEN` secret both
"Workers Scripts: Edit" and "Cloudflare Pages: Edit".

Also add the repository **variable** (not a secret; it is public) `VITE_SUPABASE_URL` so the dashboard
builds against the real API. Without it the dashboard ships in demo mode. The dashboard needs no Supabase
key: the API makes every token call for it (docs/security/authentication.md).

## 5. Free-tier limits to respect

- Workers: 100,000 requests/day on the free plan. Keep the dashboard and landing static;
  use Workers only for the thin API/edge glue.
- Pages: static asset requests are free; builds/deploys have monthly caps on the free plan.
- Design for graceful failure when a quota is reached (see docs/deployment/cloudflare.md).
