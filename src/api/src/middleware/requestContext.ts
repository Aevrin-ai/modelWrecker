import type { AppMiddleware } from "../types/appEnv";
import { requestIdFor } from "./requestId";

// runs first, so the error handler and every log line have the request id; no CORS headers, so other origins cannot read
export const requestContext: AppMiddleware = async (c, next) => {
  c.set("requestId", requestIdFor(c.req.raw));
  await next();
  c.header("X-Request-Id", c.get("requestId"));
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
};
