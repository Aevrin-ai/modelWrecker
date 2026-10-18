// first-party page analytics (docs/analytics/page-analytics.md): no cookie, no storage, no third-party script
import type { ApiApp } from "../types/appEnv";
import type { Deps } from "../types/deps";
import { RateLimiter } from "../lib/rateLimiter";
import { recordPageView } from "../controllers/collect";

export function registerCollectRoute(app: ApiApp, deps: Deps): void {
  const limiter = new RateLimiter();
  const ownHost = new URL(deps.appOrigin).hostname.toLowerCase();
  app.post("/collect", async (c) => {
    await recordPageView(c, deps, limiter, ownHost);
    // always 204: a beacon must never show an error or reveal whether it was counted
    return c.body(null, 204);
  });
}
