// Cloudflare Worker entry point (wrangler.toml `main`); there is no scheduled handler, the daily cleanup runs in Supabase
import { appFor, type App } from "./container";
import { requestIdFor } from "./middleware/requestId";
import type { Env } from "./types/env";

export type { Env } from "./types/env";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let app: App;
    try {
      app = await appFor(env);
    } catch {
      // never tell the caller which setting is wrong; the deploy logs name it
      const requestId = requestIdFor(request);
      return Response.json(
        { error: "unavailable", message: "The service is not available right now. Try again later.", requestId },
        { status: 503, headers: { "X-Request-Id": requestId } },
      );
    }
    return app.fetch(request, env, ctx);
  },
};
