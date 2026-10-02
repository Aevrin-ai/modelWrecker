// Cloudflare Worker entry point. Wires the real Supabase-backed dependencies into the app.
import { createApp } from "./app";
import { supabaseDeps } from "./db/supabase";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  APP_ORIGIN: string;
}

let cached: { key: string; app: ReturnType<typeof createApp> } | null = null;

function appFor(env: Env) {
  const key = `${env.SUPABASE_URL}|${env.APP_ORIGIN}`;
  if (cached?.key === key) return cached.app;
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("missing Supabase configuration");
  }
  const app = createApp({ ...supabaseDeps(env), appOrigin: env.APP_ORIGIN, now: () => new Date() });
  cached = { key, app };
  return app;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let app;
    try {
      app = appFor(env);
    } catch {
      // Never reveal which setting is missing to the caller; the deploy logs show it.
      console.error("api misconfigured: set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");
      return Response.json({ error: "unavailable", message: "The service is not configured." }, { status: 503 });
    }
    return app.fetch(request, env, ctx);
  },
};
