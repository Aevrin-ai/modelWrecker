// campaigns are configured here and executed only by the user's local engine
import { type ApiApp, type AppMiddleware } from "../../types/appEnv";
import type { Deps } from "../../types/deps";
import { listCampaigns, createCampaign, readCampaign, renameCampaign, deleteCampaign, moveCampaign } from "../../controllers/dashboard/campaigns";

export function registerCampaignRoutes(app: ApiApp, deps: Deps, requireUser: AppMiddleware): void {
  app.get("/campaigns", requireUser, (c) => listCampaigns(c, deps));
  app.post("/campaigns", requireUser, (c) => createCampaign(c, deps));
  app.get("/campaigns/:id", requireUser, (c) => readCampaign(c, deps));
  app.patch("/campaigns/:id", requireUser, (c) => renameCampaign(c, deps));
  app.delete("/campaigns/:id", requireUser, (c) => deleteCampaign(c, deps));
  // the strongest campaign action: flag it so the user's local engine can pick it up
  app.post("/campaigns/:id/ready", requireUser, (c) => moveCampaign(c, deps, "draft", "ready"));
  app.post("/campaigns/:id/draft", requireUser, (c) => moveCampaign(c, deps, "ready", "draft"));
}
