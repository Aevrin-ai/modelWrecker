import type { ApiApp, AppMiddleware } from "../types/appEnv";
import type { Deps } from "../types/deps";
import type { IpLimit } from "../middleware/rateLimit";
import { approveDevice } from "../controllers/deviceSignIn/approve";
import { issueDeviceCode } from "../controllers/deviceSignIn/issueCode";
import { pollDeviceToken } from "../controllers/deviceSignIn/pollToken";

/** Device sign-in (RFC 8628): the device asks for a code, then polls for its token. */
export function registerDeviceSignInRoutes(app: ApiApp, deps: Deps, limit: IpLimit): void {
  app.post("/device/code", (c) => issueDeviceCode(c, deps, limit));
  app.post("/device/token", (c) => pollDeviceToken(c, deps, limit));
}

/** The signed-in user's approval of a device sign-in. */
export function registerDeviceApprovalRoute(app: ApiApp, deps: Deps, limit: IpLimit, requireUser: AppMiddleware): void {
  app.post("/device/approve", requireUser, (c) => approveDevice(c, deps, limit));
}
