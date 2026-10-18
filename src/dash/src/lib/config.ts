const env = import.meta.env;

export type ApiMode = "mock" | "http";

// read directly, not through `env`, so Vite inlines it and an http build drops the mock clients and data
export const IS_HTTP_MODE = import.meta.env.VITE_API_MODE === "http";
export const API_MODE: ApiMode = IS_HTTP_MODE ? "http" : "mock";

export const API_BASE = (env.VITE_API_BASE || "/api/v1").replace(/\/+$/, "");

export const SUPABASE_URL = (env.VITE_SUPABASE_URL ?? "").trim();

function validSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    // plain http only for a local Supabase stack during development
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

// problems that stop http mode from starting; each names a variable, never its value
export const CONFIG_PROBLEMS: string[] = (() => {
  if (!IS_HTTP_MODE) return [];
  const problems: string[] = [];
  if (!SUPABASE_URL) problems.push("VITE_SUPABASE_URL is not set.");
  else if (!validSupabaseUrl(SUPABASE_URL)) problems.push("VITE_SUPABASE_URL is not a valid https URL.");
  return problems;
})();

export const IS_CONFIGURED = CONFIG_PROBLEMS.length === 0;

export const IS_ADMIN_APP = /^\/admin(\/|$)/.test(window.location.pathname);
export const APP_BASE = IS_ADMIN_APP ? "/admin/" : env.BASE_URL;
