import type { ApiApp, AppMiddleware } from "../../types/appEnv";
import type { Deps } from "../../types/deps";
import { overview, analyticsPage } from "../../controllers/dashboard/overview";

export function registerOverviewRoutes(app: ApiApp, deps: Deps, requireUser: AppMiddleware): void {
  app.get("/overview", requireUser, (c) => overview(c, deps));
  app.get("/analytics", requireUser, (c) => analyticsPage(c, deps));
}
