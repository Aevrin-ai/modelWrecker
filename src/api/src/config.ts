// The Worker's settings, checked before serving; problems are reported by setting name only, never a value.

export type EnvValues = Readonly<Record<string, unknown>>;

export interface ConfigReport {
  /** Settings that stop the API from working. Requests answer 503 until they are fixed. */
  errors: string[];
  /** Optional features that are half set up, so they stay off. */
  warnings: string[];
}

const REQUIRED = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "APP_ORIGIN"];
const MUST_BE_URLS = ["SUPABASE_URL", "APP_ORIGIN"];

// an optional feature turns on only when every setting in its group is present
const GROUPS: Record<string, string[]> = {
  billing: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
  "entitlement signing": ["ENTITLEMENT_SIGNING_KEY", "ENTITLEMENT_KEY_ID", "ENTITLEMENT_PUBLIC_KEY"],
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function checkConfig(env: EnvValues): ConfigReport {
  const errors: string[] = [];
  for (const name of REQUIRED) {
    if (!isSet(env[name])) errors.push(`${name} is not set`);
  }
  for (const name of MUST_BE_URLS) {
    if (isSet(env[name]) && !isServiceUrl(String(env[name]))) errors.push(`${name} must be an https URL`);
  }

  const warnings: string[] = [];
  for (const [feature, names] of Object.entries(GROUPS)) {
    const missing = names.filter((name) => !isSet(env[name]));
    const isPartial = missing.length > 0 && missing.length < names.length;
    if (isPartial) warnings.push(`${feature} is off: ${missing.join(", ")} not set`);
  }
  const hasBilling = GROUPS.billing.every((name) => isSet(env[name]));
  if (hasBilling && !isSet(env.RAZORPAY_WEBHOOK_SECRET)) {
    warnings.push("payment webhooks are off: RAZORPAY_WEBHOOK_SECRET not set");
  }
  return { errors, warnings };
}

function isSet(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

// https everywhere; plain http only for a Worker running on this machine during development
function isServiceUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname);
}
