// every admin route checks, on the server: a session (requireUser), a verified staff email, then a live admin session
import type { AppMiddleware } from "../types/appEnv";
import { ApiError } from "../lib/errors";
import { sha256Hex } from "../lib/tokens";
import { clientIp } from "./rateLimit";
import { str } from "../lib/strings";
import { STAFF_DOMAIN, isStaffEmail, totpKey, type AdminContext } from "../controllers/admin/context";

export const ADMIN_SESSION_HEADER = "x-admin-session";
export const ADMIN_TOKEN_PREFIX = "mwa_";
const SESSION_IDLE_MS = 30 * 60 * 1000;

/** Steps 1 and 2: a signed-in, verified staff account. */
export function staffOnly(admin: AdminContext): AppMiddleware {
  return async (c, next) => {
    totpKey(admin.deps);
    admin.limit(`admin:${clientIp(c)}`, 240, 60_000);
    const user = c.get("user");
    if (!isStaffEmail(user.email) || user.emailVerified !== true) {
      throw new ApiError(403, "admin_only", `The admin console is only for verified @${STAFF_DOMAIN} accounts.`);
    }
    await next();
  };
}

/** Step 3: a live admin session, issued after an authenticator code, bound to this user, at most 8 hours old. */
export function adminSession(admin: AdminContext): AppMiddleware {
  return async (c, next) => {
    const token = c.req.header(ADMIN_SESSION_HEADER) ?? "";
    if (!token.startsWith(ADMIN_TOKEN_PREFIX)) throw new ApiError(401, "admin_session_required", "Enter your authenticator code.");
    const [session] = await admin.db.table("admin_sessions").select({ eq: { token_hash: await sha256Hex(token) } });
    const now = admin.deps.now().getTime();
    const isLive =
      session &&
      session.user_id === c.get("user").id &&
      !session.revoked_at &&
      Date.parse(str(session.expires_at)) > now &&
      now - Date.parse(str(session.last_seen_at)) < SESSION_IDLE_MS;
    if (!isLive) throw new ApiError(401, "admin_session_required", "Your admin session ended. Enter your authenticator code.");
    await admin.db.table("admin_sessions").update({ id: session.id }, { last_seen_at: admin.deps.now().toISOString() });
    c.set("adminSession", session);
    await next();
  };
}
