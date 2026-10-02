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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const lastSegment = path.slice(path.lastIndexOf("/") + 1);
    const isPage = !lastSegment.includes(".");
    if (path.startsWith("/dashboard/") && isPage) {
      return env.ASSETS.fetch(new Request(new URL("/dashboard/", url), request));
    }
    if ((path === "/admin" || path.startsWith("/admin/")) && isPage) {
      const shell = await env.ASSETS.fetch(new Request(new URL("/dashboard/", url), request));
      const res = new Response(shell.body, shell);
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      res.headers.set("X-Frame-Options", "DENY");
      res.headers.set("Cache-Control", "no-store");
      res.headers.set("Referrer-Policy", "no-referrer");
      return res;
    }
    return env.ASSETS.fetch(request);
  },
};
