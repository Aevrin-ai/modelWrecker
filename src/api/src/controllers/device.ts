import type { AppContext } from "../types/appEnv";
import { MAX_SYNC_BODY_BYTES, parseBody } from "../validators/body";
import type { Deps, Row } from "../types/deps";
import { ApiError } from "../lib/errors";
import { HeartbeatReq, SyncReq } from "../validators/schemas";
import { ingestRun } from "../services/sync/ingestRun";
import { devicePolicy, entitlementFor } from "../services/devices";

export async function heartbeat(c: AppContext, deps: Deps): Promise<Response> {
  const body = await parseBody(c, HeartbeatReq);
  const device = c.get("device");
  const patch: Row = { last_seen_at: deps.now().toISOString() };
  if (body.engine_version) patch.engine_version = body.engine_version;
  await deps.serviceDb.table("devices").update({ id: device.id }, patch);
  // the allowed detail lets the engine send only what will be kept, plus a fresh signed entitlement
  return c.json({ ok: true, sync: await devicePolicy(deps, device), ...(await entitlementFor(deps, device)) });
}

export async function deviceMe(c: AppContext, deps: Deps): Promise<Response> {
  const device = c.get("device");
  return c.json({
    device_id: device.id,
    project_id: device.project_id ?? null,
    name: device.name,
    sync: await devicePolicy(deps, device),
  });
}

export async function deviceEntitlement(c: AppContext, deps: Deps): Promise<Response> {
  const entitlement = await entitlementFor(deps, c.get("device"));
  if (!entitlement.entitlement) {
    throw new ApiError(503, "entitlements_unavailable", "Entitlements are not available right now.");
  }
  return c.json(entitlement);
}

export async function syncRun(c: AppContext, deps: Deps): Promise<Response> {
  const body = await parseBody(c, SyncReq, MAX_SYNC_BODY_BYTES);
  const result = await ingestRun(deps, c.get("device"), body);
  return c.json({ ok: true, ...result });
}
