// shared request helpers for the route tests; not a test file itself
import type { createApp } from "../src/app";

export type TestApp = ReturnType<typeof createApp>;

/** A JSON response body whose fields a test only compares, never uses as typed values. */
export type ApiBody = Record<string, unknown>;

/** An error response body. */
export interface ErrorBody {
  error?: string;
  message?: string;
  requestId?: string;
}

export interface CallOptions {
  token?: string;
  session?: string;
  body?: unknown;
  raw?: string;
  headers?: Record<string, string>;
}

/** Send one request to the app under /api/v1, as the dashboard, the engine, and the admin console do. */
export async function callApi(app: TestApp, method: string, path: string, opts: CallOptions = {}): Promise<Response> {
  return app.request(`/api/v1${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.session ? { "x-admin-session": opts.session } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
  });
}

/** Read a JSON response body as the shape the test expects. */
export async function readJson<T = ApiBody>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
