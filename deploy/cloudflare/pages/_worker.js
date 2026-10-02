// Cloudflare Pages advanced-mode Worker for app.aevrin.net (copied to the site root by deploy-web.yml).
//
// Why this exists: Pages applies _redirects rules BEFORE static files, so a catch-all SPA rewrite such as
// "/dashboard/* /dashboard/ 200" also answers the dashboard's own JS and CSS with HTML. This Worker only
// rewrites page paths (no file extension) under /dashboard/ to the dashboard shell. Real files, and every
// path outside /dashboard/, go straight to the static assets. Unknown landing paths fall back to the
// landing page through Pages' default single-page-app behavior (there is no top-level 404.html).
// /api/* never reaches this Worker: the aevrin-api Worker route on the zone takes it first.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const lastSegment = path.slice(path.lastIndexOf("/") + 1);
    if (path.startsWith("/dashboard/") && !lastSegment.includes(".")) {
      return env.ASSETS.fetch(new Request(new URL("/dashboard/", url), request));
    }
    return env.ASSETS.fetch(request);
  },
};
