// the control-plane API: metadata only, so no route runs an attack, calls a model or target, or fetches a URL
import { Hono } from "hono";
import type { AppEnv } from "./types/appEnv";
import type { Deps } from "./types/deps";
import { handleError, handleNotFound } from "./middleware/errorHandler";
import { createIpLimit } from "./middleware/rateLimit";
import { requestContext } from "./middleware/requestContext";
import { userAuth } from "./middleware/userAuth";
import { registerAdminRoutes } from "./routes/admin";
import { registerAuthRoutes } from "./routes/auth";
import { registerBillingRoutes } from "./routes/billing";
import { registerCollectRoute } from "./routes/collect";
import { registerDashboardRoutes } from "./routes/dashboard";
import { registerDeviceRoutes } from "./routes/device";
import { registerDeviceApprovalRoute, registerDeviceSignInRoutes } from "./routes/deviceSignIn";
import { registerPublicRoutes } from "./routes/public";

// existing imports of AppEnv from this module keep working
export type { AppEnv } from "./types/appEnv";

export function createApp(deps: Deps) {
  const app = new Hono<AppEnv>().basePath("/api/v1");
  // one limiter for the public, device sign-in, and device routes
  const limit = createIpLimit(deps);
  const requireUser = userAuth(deps);

  app.use("*", requestContext);
  app.onError(handleError);
  app.notFound(handleNotFound);

  registerPublicRoutes(app, deps, limit);
  registerDeviceSignInRoutes(app, deps, limit);
  registerDeviceRoutes(app, deps, limit);
  registerDeviceApprovalRoute(app, deps, limit, requireUser);
  registerDashboardRoutes(app, deps, requireUser);
  registerBillingRoutes(app, deps, requireUser);
  registerAdminRoutes(app, deps, requireUser);
  registerCollectRoute(app, deps);
  registerAuthRoutes(app, deps);

  return app;
}
