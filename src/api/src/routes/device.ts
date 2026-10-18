import type { ApiApp } from "../types/appEnv";
import type { Deps } from "../types/deps";
import { deviceAuth } from "../middleware/deviceAuth";
import type { IpLimit } from "../middleware/rateLimit";
import { heartbeat, deviceMe, deviceEntitlement, syncRun } from "../controllers/device";

/** Routes a linked device calls with its device token. */
export function registerDeviceRoutes(app: ApiApp, deps: Deps, limit: IpLimit): void {
  const requireDevice = deviceAuth(deps, limit);
  app.post("/device/heartbeat", requireDevice, (c) => heartbeat(c, deps));
  app.get("/device/me", requireDevice, (c) => deviceMe(c, deps));
  app.get("/device/entitlement", requireDevice, (c) => deviceEntitlement(c, deps));
  app.post("/sync", requireDevice, (c) => syncRun(c, deps));
}
