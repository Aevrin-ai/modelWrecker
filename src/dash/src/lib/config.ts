/*
  Runtime configuration, read once from build-time env vars (see src/vite-env.d.ts).

  Two modes:
    mock (default) - the dashboard runs on src/data/mock, no sign-in. Used for local dev and the demo.
    http           - VITE_API_MODE=http. Real Google sign-in through Supabase Auth and the real
                     control-plane API (docs/architecture/control-plane-api.md).

  Every value here is public. If http mode is chosen but a required value is missing, the app shows a
  configuration error screen instead of starting (see components/ConfigError.tsx).
*/

const env = import.meta.env;

export type ApiMode = "mock" | "http";

export const API_MODE: ApiMode = env.VITE_API_MODE === "http" ? "http" : "mock";
export const IS_HTTP_MODE = API_MODE === "http";

/** Control-plane base URL, without a trailing slash. Same origin by default. */
export const API_BASE = (env.VITE_API_BASE || "/api/v1").replace(/\/+$/, "");

export const SUPABASE_URL = (env.VITE_SUPABASE_URL ?? "").trim();
export const SUPABASE_ANON_KEY = (env.VITE_SUPABASE_ANON_KEY ?? "").trim();

function validSupabaseUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol === "https:") return true;
    // Plain http only for a local Supabase stack during development.
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

/**
 * Problems that stop http mode from starting. Each entry names a variable, never its value.
 * Always empty in mock mode.
 */
export const CONFIG_PROBLEMS: string[] = (() => {
  if (!IS_HTTP_MODE) return [];
  const problems: string[] = [];
  if (!SUPABASE_URL) problems.push("VITE_SUPABASE_URL is not set.");
  else if (!validSupabaseUrl(SUPABASE_URL)) problems.push("VITE_SUPABASE_URL is not a valid https URL.");
  if (!SUPABASE_ANON_KEY) problems.push("VITE_SUPABASE_ANON_KEY is not set.");
  return problems;
})();

export const IS_CONFIGURED = CONFIG_PROBLEMS.length === 0;

/**
 * The admin console (docs/security/admin.md) is the same build served at /admin/ instead of /dashboard/.
 * Assets always load from /dashboard/; only the router base and the sign-in return address differ.
 */
export const IS_ADMIN_APP = /^\/admin(\/|$)/.test(window.location.pathname);
/** Router base and OAuth return path for this page: "/admin/" or "/dashboard/". */
export const APP_BASE = IS_ADMIN_APP ? "/admin/" : env.BASE_URL;
