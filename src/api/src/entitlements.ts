// Signed entitlements (issue #11, docs/security/entitlements.md, ADR-0018).
//
// The API signs a short statement of what an account's plan allows with an Ed25519 private key that only
// the Worker holds. The local engine checks the signature with the public key it ships with, so editing
// the cached file cannot grant more, and the check works offline until the token expires.
//
// Format: base64url(header) "." base64url(payload) "." base64url(signature over the first two parts),
// header {"alg":"EdDSA","typ":"mw-entitlement","kid":<key id>}.
import type { Db, Row } from "./db";
import { effectivePlan, type Features, type Limits, type PlanId } from "./plans";
import { usageFor } from "./usage";

export const ENTITLEMENT_TTL_S = 7 * 24 * 60 * 60;
/** The shortest life a token gets, so a plan that ends very soon still yields a usable token. */
const MIN_TTL_S = 60 * 60;

export interface EntitlementPayload {
  v: 1;
  iss: string;
  sub: string;
  dev: string | null;
  plan: PlanId;
  limits: Limits;
  features: Features;
  /** Usage the cloud has seen this period, so the engine starts from the larger of this and its own count. */
  usage: { period: string; campaigns: number; attacks: number };
  plan_ends_at: string | null;
  iat: number;
  exp: number;
}

export interface EntitlementSigner {
  keyId: string;
  /** The raw 32-byte public key, base64url. Published at GET /entitlements/keys. */
  publicKey: string;
  sign(data: Uint8Array): Promise<Uint8Array>;
}

const b64url = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromB64 = (s: string) => {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const bin = atob(norm + "=".repeat((4 - (norm.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** Build a signer from a PKCS#8 Ed25519 private key (base64) and its raw public key (base64url). */
export async function createSigner(keyId: string, privateKeyPkcs8B64: string, publicKeyB64url: string): Promise<EntitlementSigner> {
  const key = await crypto.subtle.importKey("pkcs8", fromB64(privateKeyPkcs8B64), { name: "Ed25519" }, false, ["sign"]);
  return {
    keyId,
    publicKey: publicKeyB64url,
    async sign(data) {
      return new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, key, data));
    },
  };
}

export async function signToken(signer: EntitlementSigner, payload: EntitlementPayload): Promise<string> {
  const enc = new TextEncoder();
  const head = b64url(enc.encode(JSON.stringify({ alg: "EdDSA", typ: "mw-entitlement", kid: signer.keyId })));
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await signer.sign(enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

/** Verify a token with a raw public key. Used by tests and by the e2e check; the engine has its own. */
export async function verifyToken(token: string, publicKeyB64url: string): Promise<EntitlementPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const key = await crypto.subtle.importKey("raw", fromB64(publicKeyB64url), { name: "Ed25519" }, false, ["verify"]);
  const ok = await crypto.subtle.verify({ name: "Ed25519" }, key, fromB64(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) return null;
  return JSON.parse(new TextDecoder().decode(fromB64(parts[1]))) as EntitlementPayload;
}

/** Issue a fresh entitlement for one device of one account. */
export async function issueEntitlement(
  signer: EntitlementSigner,
  db: Db,
  issuer: string,
  device: Row,
  now: Date,
): Promise<{ token: string; payload: EntitlementPayload }> {
  const owner = String(device.owner_id);
  const [sub] = await db.table("subscriptions").select({ eq: { owner_id: owner } });
  const eff = effectivePlan(sub, now);
  const usage = await usageFor(db, owner, now);
  const iat = Math.floor(now.getTime() / 1000);
  let exp = iat + ENTITLEMENT_TTL_S;
  if (eff.periodEnd) exp = Math.min(exp, Math.max(iat + MIN_TTL_S, Math.floor(Date.parse(eff.periodEnd) / 1000)));
  const payload: EntitlementPayload = {
    v: 1,
    iss: issuer,
    sub: owner,
    dev: device.id ? String(device.id) : null,
    plan: eff.planId,
    limits: eff.limits,
    features: eff.features,
    usage: { period: usage.period, campaigns: usage.values.campaigns, attacks: usage.values.attacks },
    plan_ends_at: eff.periodEnd,
    iat,
    exp,
  };
  return { token: await signToken(signer, payload), payload };
}
