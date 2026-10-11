// Cloudflare Pages advanced-mode Worker for app.aevrin.net (copied to the site root by deploy-web.yml).
//
// Why this exists: Pages applies _redirects rules BEFORE static files, so a catch-all SPA rewrite such as
// "/dashboard/* /dashboard/ 200" also answers the dashboard's own JS and CSS with HTML. This Worker only
// rewrites page paths (no file extension) under /dashboard/ and /admin to the dashboard shell. Real files,
// and every other path, go straight to the static assets. Unknown landing paths fall back to the landing
// page through Pages' default single-page-app behavior (there is no top-level 404.html).
// /api/* never reaches this Worker: the aevrin-api Worker route on the zone takes it first.
//
// /admin is the staff console (docs/security/admin.md). It is the same dashboard build; the API decides
// who may use it. Its pages are never indexed, framed, or cached.
//
// Every HTML page gets a Content-Security-Policy (docs/security/SECURITY.md). Scripts run only from this
// site, Razorpay Checkout, and Cloudflare Web Analytics, plus the landing page's own inline scripts by
// hash. deploy-web.yml fills in __INLINE_SCRIPT_HASHES__ with those hashes (csp-hashes.mjs). The
// per-request nonce is for the bot-check script Cloudflare injects at the edge: Cloudflare copies the
// nonce from this header onto it.

const INLINE_SCRIPT_HASHES = "__INLINE_SCRIPT_HASHES__";

function contentSecurityPolicy(nonce) {
  const hashes = INLINE_SCRIPT_HASHES.startsWith("__") ? "" : ` ${INLINE_SCRIPT_HASHES}`;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${hashes} https://*.razorpay.com https://static.cloudflareinsights.com`,
    // Inline style attributes come from the prerendered page and the animation library.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://*.razorpay.com",
    "connect-src 'self' https://*.razorpay.com https://cloudflareinsights.com",
    "frame-src https://*.razorpay.com",
    "form-action 'self' https://*.razorpay.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function newNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

function withPageHeaders(response, extra = {}) {
  const res = new Response(response.body, response);
  if ((res.headers.get("content-type") ?? "").includes("text/html")) {
    res.headers.set("Content-Security-Policy", contentSecurityPolicy(newNonce()));
    res.headers.set("X-Content-Type-Options", "nosniff");
  }
  for (const [name, value] of Object.entries(extra)) res.headers.set(name, value);
  return res;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const lastSegment = path.slice(path.lastIndexOf("/") + 1);
    const isPage = !lastSegment.includes(".");
    if (path.startsWith("/dashboard/") && isPage) {
      return withPageHeaders(await env.ASSETS.fetch(new Request(new URL("/dashboard/", url), request)));
    }
    if ((path === "/admin" || path.startsWith("/admin/")) && isPage) {
      const shell = await env.ASSETS.fetch(new Request(new URL("/dashboard/", url), request));
      return withPageHeaders(shell, {
        "X-Robots-Tag": "noindex, nofollow",
        "X-Frame-Options": "DENY",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      });
    }
    return withPageHeaders(await env.ASSETS.fetch(request));
  },
};
