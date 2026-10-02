// Cloudflare Worker entry point. Wires the real Supabase-backed dependencies into the app.
import { createApp, runMaintenance } from "./app";
import { supabaseDeps } from "./db/supabase";
import { createSigner, type EntitlementSigner } from "./entitlements";
import { HttpRazorpay, type BillingConfig } from "./razorpay";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  APP_ORIGIN: string;
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
    console.error("entitlement signing key could not be loaded; devices get the free baseline");
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

function appFor(env: Env): Promise<App> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("missing Supabase configuration");
  }
  const key = `${env.SUPABASE_URL}|${env.APP_ORIGIN}`;
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
      // Never reveal which setting is missing to the caller; the deploy logs show it.
      console.error("api misconfigured: set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");
      return Response.json({ error: "unavailable", message: "The service is not configured." }, { status: 503 });
    }
    return app.fetch(request, env, ctx);
  },

  // Daily upkeep (wrangler.toml [triggers]): data retention and confirming recent unpaid orders.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
    ctx.waitUntil(
      depsFor(env)
        .then(runMaintenance)
        .then((r) => console.log("maintenance", JSON.stringify(r)))
        .catch((err) => console.error("maintenance failed", err instanceof Error ? err.message : String(err))),
    );
  },
};
