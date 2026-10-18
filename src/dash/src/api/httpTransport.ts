import { authTokens } from "@/lib/auth";
import { ApiError } from "./apiError";
import { safeError } from "./errorMessage";
import { sendWithSession } from "./session";

const TIMEOUT_MS = 20_000;

export interface HttpTransport {
  request<T>(method: string, path: string, body?: unknown): Promise<T>;
  get<T>(path: string): Promise<T>;
  getOrNull<T>(path: string): Promise<T | null>;
}

// a bearer token from the in-memory session, never a cookie, so there is no cross-site request forgery
async function sendOnce(baseUrl: string, method: string, path: string, token: string, body?: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, "network_error", "The control plane did not respond.");
  } finally {
    clearTimeout(timer);
  }
}

// never surface a non-JSON body, so a bad answer becomes undefined instead of raw text
function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function request<T>(baseUrl: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await sendWithSession(authTokens, (token) => sendOnce(baseUrl, method, path, token, body));
  if (!res) throw new ApiError(401, "unauthorized", "Your session has ended. Please sign in again.");

  const text = res.status === 204 ? "" : await res.text().catch(() => "");
  const parsed = parseJson(text);

  if (!res.ok) {
    const { code, message, requestId } = safeError(res.status, parsed, res.headers.get("x-request-id"));
    throw new ApiError(res.status, code, message, requestId);
  }
  if (text && parsed === undefined) {
    throw new ApiError(res.status, "bad_response", "The control plane sent an unexpected response.");
  }
  return parsed as T;
}

export function createHttpTransport(baseUrl: string): HttpTransport {
  const get = <T>(path: string) => request<T>(baseUrl, "GET", path);

  return {
    request: (method, path, body) => request(baseUrl, method, path, body),
    get,
    // a 404 means "not found" (null), as in the mock
    async getOrNull<T>(path: string): Promise<T | null> {
      try {
        return await get<T>(path);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  };
}
