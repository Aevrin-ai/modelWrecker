import type { AppContext } from "../../types/appEnv";
import { parseBody } from "../../validators/body";
import type { Deps } from "../../types/deps";
import { randomToken, sha256Hex, userCode } from "../../lib/tokens";
import type { IpLimit } from "../../middleware/rateLimit";
import { DeviceCodeReq } from "../../validators/schemas";
import { DEVICE_CODE_TTL_S, POLL_INTERVAL_S } from "./constants";

// a fresh code is drawn up to five more times while it clashes with a stored one
const USER_CODE_RETRIES = 5;

async function unusedUserCode(deps: Deps): Promise<string> {
  let code = userCode();
  for (let i = 0; i < USER_CODE_RETRIES; i++) {
    const clash = await deps.serviceDb.table("device_auth_requests").select({ eq: { user_code: code } });
    if (clash.length === 0) break;
    code = userCode();
  }
  return code;
}

/** Step 1 of RFC 8628: a device asks for a code the user approves in the dashboard. */
export async function issueDeviceCode(c: AppContext, deps: Deps, limit: IpLimit): Promise<Response> {
  limit(c, "device-code", 10, 60_000);
  const body = await parseBody(c, DeviceCodeReq);
  const deviceCode = randomToken(32);
  const now = deps.now();
  const code = await unusedUserCode(deps);
  await deps.serviceDb.table("device_auth_requests").insert({
    device_code_hash: await sha256Hex(deviceCode),
    user_code: code,
    name: body.name,
    os: body.os,
    engine_version: body.engine_version,
    status: "pending",
    expires_at: new Date(now.getTime() + DEVICE_CODE_TTL_S * 1000).toISOString(),
  });
  const verificationUri = `${deps.appOrigin}/dashboard/connect`;
  return c.json({
    device_code: deviceCode,
    user_code: code,
    verification_uri: verificationUri,
    verification_uri_complete: `${verificationUri}?code=${code}`,
    expires_in: DEVICE_CODE_TTL_S,
    interval: POLL_INTERVAL_S,
  });
}
