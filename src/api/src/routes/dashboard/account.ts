import type { ApiApp, AppMiddleware } from "../../types/appEnv";
import type { Deps } from "../../types/deps";
import { readAccount, renameAccount } from "../../controllers/dashboard/account";

export function registerAccountRoutes(app: ApiApp, deps: Deps, requireUser: AppMiddleware): void {
  app.get("/me", requireUser, (c) => readAccount(c, deps));
  app.patch("/me", requireUser, (c) => renameAccount(c, deps));
}
