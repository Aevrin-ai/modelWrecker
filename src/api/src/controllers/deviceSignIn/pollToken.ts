import type { AppContext } from "../../types/appEnv";
import { parseBody } from "../../validators/body";
import type { Deps, Row } from "../../types/deps";
import { DEVICE_TOKEN_PREFIX, randomToken, sha256Hex } from "../../lib/tokens";
import type { IpLimit } from "../../middleware/rateLimit";
import { DeviceTokenReq } from "../../validators/schemas";
import { POLL_INTERVAL_S } from "./constants";
import { deviceAuthRequestsRepository } from "../../repositories/deviceAuthRequests";
import { devicesRepository } from "../../repositories/devices";
import { str } from "../../lib/strings";

/** RFC 8628 errors are returned as 400 with the standard error code. */
const oauthError = (c: AppContext, code: string) => c.json({ error: code }, 400);

/** The RFC 8628 error for a request that is not approved yet, or null once it is approved. */
function notApprovedError(status: unknown): string | null {
  if (status === "pending") return "authorization_pending";
  if (status === "denied") return "access_denied";
  if (status !== "approved") return "expired_token";
  return null;
}

// the token is minted now and returned once; only its hash is stored
async function mintDeviceToken(deps: Deps, request: Row, now: Date) {
  const token = `${DEVICE_TOKEN_PREFIX}${randomToken(32)}`;
  const device = await devicesRepository(deps.serviceDb).insert({
    owner_id: request.owner_id,
    project_id: request.project_id ?? null,
    name: request.name,
    os: request.os ?? "",
    engine_version: request.engine_version ?? "",
    credential_hash: await sha256Hex(token),
    last_seen_at: now.toISOString(),
    revoked: false,
  });
  await deviceAuthRequestsRepository(deps.serviceDb).linkDevice(str(request.id), str(device.id));
  return { device_token: token, device_id: device.id, project_id: request.project_id ?? null };
}

/** Step 2 of RFC 8628: the device polls until the user approves, then gets its token exactly once. */
export async function pollDeviceToken(c: AppContext, deps: Deps, limit: IpLimit): Promise<Response> {
  limit(c, "device-token", 120, 60_000);
  const body = await parseBody(c, DeviceTokenReq);
  const requests = deviceAuthRequestsRepository(deps.serviceDb);
  const request = await requests.findByDeviceCodeHash(await sha256Hex(body.device_code));
  const now = deps.now();
  if (!request || new Date(String(request.expires_at)).getTime() <= now.getTime()) return oauthError(c, "expired_token");

  const lastPolledAt = request.last_polled_at ? new Date(String(request.last_polled_at)).getTime() : 0;
  await requests.recordPoll(str(request.id), now.toISOString());
  if (lastPolledAt && now.getTime() - lastPolledAt < (POLL_INTERVAL_S - 1) * 1000) return oauthError(c, "slow_down");

  const statusError = notApprovedError(request.status);
  if (statusError) return oauthError(c, statusError);

  // claim the approval exactly once; a concurrent second poll finds nothing to claim
  const isClaimed = await requests.consume(str(request.id));
  if (!isClaimed) return oauthError(c, "expired_token");
  return c.json(await mintDeviceToken(deps, request, now));
}
