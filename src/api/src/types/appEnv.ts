import type { Context, Hono, MiddlewareHandler } from "hono";
import type { AuthUser, Database, Row } from "./deps";

/** The values middleware sets on a request's context. */
export type AppEnv = {
  Variables: {
    requestId: string;
    user: AuthUser;
    db: Database;
    device: Row;
    adminSession: Row;
  };
};

export type AppContext = Context<AppEnv>;
export type ApiApp = Hono<AppEnv>;
export type AppMiddleware = MiddlewareHandler<AppEnv>;

/** A path parameter of the matched route. Every route that reads one declares it, so it is never empty. */
export function routeParam(c: AppContext, name: string): string {
  return c.req.param(name) ?? "";
}
