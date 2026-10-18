import type { AppMiddleware } from "../types/appEnv";
import type { Deps } from "../types/deps";
import { ApiError } from "../lib/errors";
import { DEVICE_TOKEN_PREFIX, bearer } from "../lib/tokens";
import { refuseSuspended } from "./refuseSuspended";

/** User authentication: verify the Supabase token, then query as that user so RLS applies. */
export function userAuth(deps: Deps): AppMiddleware {
  return async (c, next) => {
    const token = bearer(c.req.header("authorization"));
    if (!token || token.startsWith(DEVICE_TOKEN_PREFIX)) {
      throw new ApiError(401, "unauthenticated", "Sign in to continue.");
    }
    const user = await deps.verifyUser(token);
    if (!user) throw new ApiError(401, "unauthenticated", "Your session has expired. Sign in again.");
    await refuseSuspended(deps, user.id);
    c.set("user", user);
    c.set("db", deps.userDb(token));
    await next();
  };
}
