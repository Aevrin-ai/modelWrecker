// findings change only their lifecycle status here; the evidence on the device is never touched
import { type ApiApp, type AppMiddleware } from "../../types/appEnv";
import type { Deps } from "../../types/deps";
import { listFindings, readFinding, updateFindingStatus } from "../../controllers/dashboard/findings";

export function registerFindingRoutes(app: ApiApp, deps: Deps, requireUser: AppMiddleware): void {
  app.get("/findings", requireUser, (c) => listFindings(c, deps));
  app.get("/findings/:id", requireUser, (c) => readFinding(c, deps));
  app.patch("/findings/:id", requireUser, (c) => updateFindingStatus(c, deps));
}
