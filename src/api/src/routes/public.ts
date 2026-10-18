import type { ApiApp } from "../types/appEnv";
import type { Deps } from "../types/deps";
import type { IpLimit } from "../middleware/rateLimit";
import { readiness, entitlementKeys } from "../controllers/public";

/** Routes anyone may call: liveness, readiness, and the entitlement public key. */
export function registerPublicRoutes(app: ApiApp, deps: Deps, limit: IpLimit): void {
  // liveness: the Worker runs; it reads no database and says nothing about configuration
  app.get("/health", (c) => c.json({ ok: true }));
  app.get("/health/ready", (c) => readiness(c, deps, limit));
  app.get("/entitlements/keys", (c) => entitlementKeys(c, deps));
}
