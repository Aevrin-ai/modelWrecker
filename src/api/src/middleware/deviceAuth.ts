import type { AppMiddleware } from "../types/appEnv";
import type { Deps } from "../types/deps";
import { ApiError } from "../lib/errors";
import { DEVICE_TOKEN_PREFIX, bearer, sha256Hex } from "../lib/tokens";
import type { IpLimit } from "./rateLimit";
import { refuseSuspended } from "./refuseSuspended";

// attached per route, never as a catch-all, so device and user credentials are never accepted on each other's routes
export function deviceAuth(deps: Deps, limit: IpLimit): AppMiddleware {
  return async (c, next) => {
    limit(c, "device", 120, 60_000);
    const token = bearer(c.req.header("authorization"));
    if (!token || !token.startsWith(DEVICE_TOKEN_PREFIX)) {
      throw new ApiError(401, "invalid_token", "A device token is required.");
    }
    const [row] = await deps.serviceDb.table("devices").select({ eq: { credential_hash: await sha256Hex(token) } });
    if (!row || row.revoked) throw new ApiError(401, "invalid_token", "This device token is not valid.");
    await refuseSuspended(deps, String(row.owner_id));
    c.set("device", row);
    await next();
  };
}
