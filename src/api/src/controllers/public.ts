import type { AppContext } from "../types/appEnv";
import type { Deps } from "../types/deps";
import { checkDatabase } from "../services/health";
import type { IpLimit } from "../middleware/rateLimit";

// public, so it is rate limited and returns no internals
export async function readiness(c: AppContext, deps: Deps, limit: IpLimit): Promise<Response> {
  limit(c, "health-ready", 30, 60_000);
  const database = await checkDatabase(deps.serviceDb);
  const isReady = database === "ok";
  return c.json({ ok: isReady, checks: { database } }, isReady ? 200 : 503);
}

// the public half of the entitlement signing key, so anyone can check a token the engine holds
export function entitlementKeys(c: AppContext, deps: Deps): Response {
  const { signer } = deps;
  const keys = signer ? [{ kid: signer.keyId, kty: "OKP", crv: "Ed25519", alg: "EdDSA", x: signer.publicKey }] : [];
  return c.json({ keys });
}
