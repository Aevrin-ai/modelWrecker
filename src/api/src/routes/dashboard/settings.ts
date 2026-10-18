import type { ApiApp, AppMiddleware } from "../../types/appEnv";
import type { Deps } from "../../types/deps";
import { getSettings, updateSettings } from "../../controllers/dashboard/settings";

export function registerSettingsRoutes(app: ApiApp, deps: Deps, requireUser: AppMiddleware): void {
  app.get("/settings", requireUser, (c) => getSettings(c, deps));
  app.patch("/settings", requireUser, (c) => updateSettings(c, deps));
}
