// target registration metadata only; the cloud never contacts a target
import { type ApiApp, type AppMiddleware } from "../../types/appEnv";
import type { Deps } from "../../types/deps";
import { listTargets, createTarget, readTarget } from "../../controllers/dashboard/targets";

export function registerTargetRoutes(app: ApiApp, deps: Deps, requireUser: AppMiddleware): void {
  app.get("/targets", requireUser, (c) => listTargets(c, deps));
  app.post("/targets", requireUser, (c) => createTarget(c, deps));
  app.get("/targets/:id", requireUser, (c) => readTarget(c, deps));
}
