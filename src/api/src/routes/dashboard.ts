// dashboard routes: each query runs as the user (Postgres RLS) AND filters by owner_id, so accounts never mix
import type { ApiApp, AppMiddleware } from "../types/appEnv";
import type { Deps } from "../types/deps";
import { PLANS } from "../services/billing/plans";
import { registerAccountRoutes } from "./dashboard/account";
import { registerCampaignActivityRoutes } from "./dashboard/campaignActivity";
import { registerCampaignRoutes } from "./dashboard/campaigns";
import { registerDeviceManagementRoutes } from "./dashboard/devices";
import { registerFindingRoutes } from "./dashboard/findings";
import { registerOverviewRoutes } from "./dashboard/overview";
import { registerProjectRoutes } from "./dashboard/projects";
import { registerSearchRoute } from "./dashboard/search";
import { registerSettingsRoutes } from "./dashboard/settings";
import { registerTargetRoutes } from "./dashboard/targets";

/** Every route the dashboard calls. Responses use its types (src/dash/src/types/index.ts). */
export function registerDashboardRoutes(app: ApiApp, deps: Deps, requireUser: AppMiddleware): void {
  registerAccountRoutes(app, deps, requireUser);
  registerOverviewRoutes(app, deps, requireUser);
  registerProjectRoutes(app, deps, requireUser);
  registerTargetRoutes(app, deps, requireUser);
  registerCampaignRoutes(app, deps, requireUser);
  registerCampaignActivityRoutes(app, deps, requireUser);
  registerFindingRoutes(app, deps, requireUser);
  registerDeviceManagementRoutes(app, deps, requireUser);
  // report files are not synced yet
  app.get("/reports", requireUser, (c) => c.json([]));
  // public: the same prices the landing page shows
  app.get("/plans", (c) => c.json(PLANS));
  registerSettingsRoutes(app, deps, requireUser);
  // notifications are not built yet
  app.get("/notifications", requireUser, (c) => c.json([]));
  registerSearchRoute(app, deps, requireUser);
}
