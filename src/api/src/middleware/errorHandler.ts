import type { AppContext } from "../types/appEnv";
import { classifyError } from "../lib/errors";
import { errorFields, log } from "../lib/log";

/** The one place a thrown error becomes a response; only unexpected failures are logged, with diagnostics. */
export function handleError(err: unknown, c: AppContext): Response {
  const requestId = c.get("requestId");
  const failure = classifyError(err);
  if (failure.unexpected) {
    const fields = { requestId, method: c.req.method, path: c.req.path, status: failure.status, ...errorFields(err) };
    if (failure.status === 503) log.warn("request_unavailable", fields);
    else log.error("request_failed", fields);
  }
  return c.json({ error: failure.code, message: failure.message, requestId }, failure.status);
}

export function handleNotFound(c: AppContext): Response {
  return c.json({ error: "not_found", message: "No such route.", requestId: c.get("requestId") }, 404);
}
