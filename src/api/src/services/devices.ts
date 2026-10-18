import type { Deps, Row } from "../types/deps";
import { issueEntitlement } from "./entitlements/signing";
import { readSyncPolicy } from "./sync/syncPolicy";

interface DeviceEntitlement {
  entitlement?: string;
  plan?: string;
  expires_at?: string;
}

export async function devicePolicy(deps: Deps, device: Row) {
  const policy = await readSyncPolicy(deps.serviceDb, String(device.owner_id), deps.now());
  return { metadata: true, evidence: policy.evidence, transcripts: policy.transcripts };
}

/** A fresh signed entitlement for a device, or nothing when signing is not configured (free baseline). */
export async function entitlementFor(deps: Deps, device: Row): Promise<DeviceEntitlement> {
  if (!deps.signer) return {};
  const issuer = deps.entitlementIssuer ?? deps.appOrigin;
  const { token, payload } = await issueEntitlement(deps.signer, deps.serviceDb, issuer, device, deps.now());
  return { entitlement: token, plan: payload.plan, expires_at: new Date(payload.exp * 1000).toISOString() };
}
