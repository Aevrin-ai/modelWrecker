import { ApiError } from "@/api/httpClient";
import { sendWithSession } from "@/api/session";
import { API_BASE } from "@/lib/config";
import { authTokens } from "@/lib/auth";
import { currentSession, sessionEnded } from "./adminSession";

const TIMEOUT_MS = 20_000;

// every call carries the sign-in token and the admin session token (X-Admin-Session), never a cookie
async function sendOnce(method: string, path: string, token: string, session: string | null, body?: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(session ? { "X-Admin-Session": session } : {}),
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

// a body that is not JSON reads as empty, so raw text never reaches the UI
function parseBody(text: string): Record<string, unknown> {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export async function adminRequest<T>(method: string, path: string, body?: unknown, withSession = true): Promise<T> {
  const session = withSession ? currentSession() : null;
  if (withSession && !session) sessionEnded("Enter your authenticator code.");
  // an expired sign-in token is refreshed once and retried once (src/api/session.ts)
  const res = await sendWithSession(authTokens, (token) => sendOnce(method, path, token, session, body));
  if (!res) throw new ApiError(401, "unauthorized", "Your session has ended. Please sign in again.");
  const text = res.status === 204 ? "" : await res.text().catch(() => "");
  const parsed = parseBody(text);
  if (!res.ok) {
    const code = typeof parsed.error === "string" ? parsed.error : `http_${res.status}`;
    const message = typeof parsed.message === "string" ? parsed.message.slice(0, 300) : "The request failed.";
    // a 401 admin_session_required drops the stored session so the code screen shows again
    if (code === "admin_session_required") sessionEnded(message);
    throw new ApiError(res.status, code, message);
  }
  return parsed as T;
}
