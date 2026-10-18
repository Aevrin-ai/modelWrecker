import { type ApiApp, type AppMiddleware } from "../../types/appEnv";
import type { Deps } from "../../types/deps";
import { listDevices, readDevice, renameDevice, revokeDevice } from "../../controllers/dashboard/devices";

export function registerDeviceManagementRoutes(app: ApiApp, deps: Deps, requireUser: AppMiddleware): void {
  app.get("/devices", requireUser, (c) => listDevices(c, deps));
  app.get("/devices/:id", requireUser, (c) => readDevice(c, deps));
  app.patch("/devices/:id", requireUser, (c) => renameDevice(c, deps));
  app.post("/devices/:id/revoke", requireUser, (c) => revokeDevice(c, deps));
}
