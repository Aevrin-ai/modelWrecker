import type { ApiApp, AppMiddleware } from "../../types/appEnv";
import type { Deps } from "../../types/deps";
import { search } from "../../controllers/dashboard/search";

export function registerSearchRoute(app: ApiApp, deps: Deps, requireUser: AppMiddleware): void {
  app.get("/search", requireUser, (c) => search(c, deps));
}
