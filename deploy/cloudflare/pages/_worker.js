// the Pages advanced-mode Worker for vyra.aevrin.ai (copied by deploy-web.yml); the API Worker route takes /api/* first

// deploy-web.yml runs csp-hashes.mjs, which replaces this placeholder with the landing page's inline-script hashes
const INLINE_SCRIPT_HASHES = "__INLINE_SCRIPT_HASHES__";

// every HTML page gets this CSP: scripts only from this site, Razorpay Checkout, Cloudflare Web Analytics and hashes
function contentSecurityPolicy(nonce) {
  const hashes = INLINE_SCRIPT_HASHES.startsWith("__") ? "" : ` ${INLINE_SCRIPT_HASHES}`;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${hashes} https://*.razorpay.com https://static.cloudflareinsights.com`,
    // inline style attributes come from the prerendered page and the animation library
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

// a per-request nonce for the bot-check script Cloudflare injects at the edge; it copies the nonce from this header
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

// no _redirects file: Pages applies it before static files, so an SPA rewrite would answer the dashboard's JS with HTML
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const lastSegment = path.slice(path.lastIndexOf("/") + 1);
    const isPage = !lastSegment.includes(".");
    if (path.startsWith("/dashboard/") && isPage) {
      return withPageHeaders(await env.ASSETS.fetch(new Request(new URL("/dashboard/", url), request)));
    }
    // /admin is the staff console (docs/security/admin.md): the API decides who may use it; never indexed, framed or cached
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
