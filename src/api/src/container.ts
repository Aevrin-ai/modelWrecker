// composition root: checks the settings, builds the Supabase-backed dependencies, and keeps one app per isolate
import { createApp } from "./app";
import { checkConfig } from "./config/checkConfig";
import { supabaseDeps } from "./database/supabase";
import { log } from "./lib/log";
import { createSigner, type EntitlementSigner } from "./services/entitlements/signing";
import { HttpRazorpay, type BillingConfig } from "./services/razorpay/client";
import type { Env } from "./types/env";

export type App = ReturnType<typeof createApp>;

let cached: { key: string; app: Promise<App> } | null = null;

// a bad setting is logged once per isolate, so it shows in the logs without repeating on every request
const reported = new Set<string>();

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

async function build(env: Env): Promise<App> {
  return createApp({
    ...supabaseDeps(env),
    appOrigin: env.APP_ORIGIN,
    entitlementIssuer: env.ENTITLEMENT_ISSUER || "https://app.aevrin.net",
    now: () => new Date(),
    billing: billingFor(env),
    signer: await signerFor(env),
    admin: env.ADMIN_TOTP_KEY ? { totpKey: env.ADMIN_TOTP_KEY } : undefined,
    analyticsSalt: env.ANALYTICS_SALT || undefined,
  });
}

function reportOnce(level: "warn" | "error", event: string, problem: string): void {
  if (reported.has(problem)) return;
  reported.add(problem);
  log[level](event, { problem });
}

// throws when a required setting is missing or invalid; the caller answers 503 without saying which
export function appFor(env: Env): Promise<App> {
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
