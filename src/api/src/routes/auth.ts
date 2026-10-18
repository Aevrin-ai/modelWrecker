// dashboard sign-in tokens: the refresh token lives only in an HttpOnly cookie; the access token stays in page memory
import type { ApiApp } from "../types/appEnv";
import type { Deps } from "../types/deps";
import { createKeyLimit } from "../middleware/rateLimit";
import { finishSignIn, refreshSession, logout } from "../controllers/auth/session";

export function registerAuthRoutes(app: ApiApp, deps: Deps): void {
  const limit = createKeyLimit(deps);
  app.post("/auth/session", (c) => finishSignIn(c, deps, limit));
  app.post("/auth/refresh", (c) => refreshSession(c, deps, limit));
  app.post("/auth/logout", (c) => logout(c, deps, limit));
}
