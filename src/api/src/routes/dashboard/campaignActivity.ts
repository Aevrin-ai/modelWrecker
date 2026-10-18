import { type ApiApp, type AppMiddleware } from "../../types/appEnv";
import type { Deps } from "../../types/deps";
import { campaignTimeline, campaignStats, campaignTranscript } from "../../controllers/dashboard/campaignActivity";

export function registerCampaignActivityRoutes(app: ApiApp, deps: Deps, requireUser: AppMiddleware): void {
  app.get("/campaigns/:id/timeline", requireUser, (c) => campaignTimeline(c, deps));
  app.get("/campaigns/:id/stats", requireUser, (c) => campaignStats(c, deps));
  app.get("/campaigns/:id/transcript", requireUser, (c) => campaignTranscript(c, deps));
}
