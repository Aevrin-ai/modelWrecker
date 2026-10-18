// Cloudflare Worker entry point: checks the settings, then wires the Supabase-backed dependencies into the app.
import { createApp } from "./app";
import { checkConfig } from "./config";
import { supabaseDeps } from "./db/supabase";
import { createSigner, type EntitlementSigner } from "./entitlements";
import { log } from "./log";
import { HttpRazorpay, type BillingConfig } from "./razorpay";
import { requestIdFor } from "./requestId";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  APP_ORIGIN: string;
  // The entitlement issuer. Kept at https://app.aevrin.net even after the browser origin moves, because
  // every shipped engine trusts only that issuer. Defaults to app.aevrin.net when unset.
  ENTITLEMENT_ISSUER?: string;
  // Billing (secrets). Without the key pair, billing routes answer 503.
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  // Entitlement signing. The private key is a secret; the key id and public key are public vars.
  ENTITLEMENT_SIGNING_KEY?: string;
  ENTITLEMENT_KEY_ID?: string;
  ENTITLEMENT_PUBLIC_KEY?: string;
  // Admin console (secret): encrypts authenticator secrets at rest.
  ADMIN_TOTP_KEY?: string;
  // Page analytics (secret): mixed into the daily visitor hash.
  ANALYTICS_SALT?: string;
}

type App = ReturnType<typeof createApp>;
let cached: { key: string; app: Promise<App> } | null = null;

async function signerFor(env: Env): Promise<EntitlementSigner | undefined> {
  if (!env.ENTITLEMENT_SIGNING_KEY || !env.ENTITLEMENT_KEY_ID || !env.ENTITLEMENT_PUBLIC_KEY) return undefined;
  try {
    return await createSigner(env.ENTITLEMENT_KEY_ID, env.ENTITLEMENT_SIGNING_KEY, env.ENTITLEMENT_PUBLIC_KEY);
  } catch {
    log.error("entitlement_key_invalid", { effect: "devices get the free baseline" });
    return undefined;
  }
}

function billingFor(env: Env): BillingConfig | undefined {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return undefined;
  return {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET ?? "",
    api: new HttpRazorpay(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET),
  };
}

async function depsFor(env: Env) {
  return {
    ...supabaseDeps(env),
    appOrigin: env.APP_ORIGIN,
    entitlementIssuer: env.ENTITLEMENT_ISSUER || "https://app.aevrin.net",
    now: () => new Date(),
    billing: billingFor(env),
    signer: await signerFor(env),
    admin: env.ADMIN_TOTP_KEY ? { totpKey: env.ADMIN_TOTP_KEY } : undefined,
    analyticsSalt: env.ANALYTICS_SALT || undefined,
  };
}

async function build(env: Env): Promise<App> {
  return createApp(await depsFor(env));
}

// logged once per isolate, so a bad setting shows in the logs without repeating on every request
const reported = new Set<string>();

function reportOnce(level: "warn" | "error", event: string, problem: string): void {
  if (reported.has(problem)) return;
  reported.add(problem);
  log[level](event, { problem });
}

function appFor(env: Env): Promise<App> {
  const config = checkConfig({ ...env });
  if (config.errors.length > 0) {
    for (const problem of config.errors) reportOnce("error", "config_invalid", problem);
    throw new Error("the Worker is not configured");
  }
  for (const problem of config.warnings) reportOnce("warn", "config_incomplete", problem);
  const key = `${env.SUPABASE_URL}|${env.APP_ORIGIN}|${env.ENTITLEMENT_ISSUER ?? ""}`;
  if (cached?.key === key) return cached.app;
  const app = build(env);
  cached = { key, app };
  app.catch(() => {
    cached = null;
  });
  return app;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let app: App;
    try {
      app = await appFor(env);
    } catch {
      // never tell the caller which setting is wrong; the deploy logs name it
      const requestId = requestIdFor(request);
      return Response.json(
        { error: "unavailable", message: "The service is not available right now. Try again later.", requestId },
        { status: 503, headers: { "X-Request-Id": requestId } },
      );
    }
    return app.fetch(request, env, ctx);
  },
  // No scheduled handler: the daily data cleanup runs in Supabase with pg_cron (migration 0006).
};
