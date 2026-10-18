import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { parseBody } from "../../validators/body";
import type { AuthTokens, Deps, GrantResult } from "../../types/deps";
import { ApiError } from "../../lib/errors";
import { bearer } from "../../lib/tokens";
import { clientIp, type KeyLimit } from "../../middleware/rateLimit";
import { AuthRefreshReq, AuthSessionReq } from "../../validators/schemas";
import { REFRESH_COOKIE, clearSessionCookies, setSessionCookies } from "./cookies";
import { revoke } from "../../services/supabaseAuth/revokeSession";

const SESSION_ENDED = "Your session has ended. Please sign in again.";

// against CSRF: the custom header needs a CORS preflight this API never grants; SameSite and Origin add layers
function guard(c: Context, deps: Deps, limit: KeyLimit, max: number): AuthTokens {
  const origin = c.req.header("origin");
  const site = c.req.header("sec-fetch-site");
  const isForeign = (origin && origin !== deps.appOrigin) || (site && site !== "same-origin");
  if (c.req.header("x-aevrin-auth") !== "1" || isForeign) {
    throw new ApiError(403, "forbidden", "This request is not allowed.");
  }
  limit(`auth:${clientIp(c)}`, max, 60_000);
  if (!deps.authTokens) throw new ApiError(503, "auth_unavailable", "Sign-in is not available right now.");
  return deps.authTokens;
}

function answerWithGrant(c: Context, result: GrantResult): Response {
  if (!result.ok) {
    // an outage keeps the cookie, so the session survives it; anything else ends the session
    if (result.reason === "unavailable") throw new ApiError(503, "auth_unavailable", "Sign-in is not available right now. Try again.");
    clearSessionCookies(c);
    throw new ApiError(401, "session_ended", SESSION_ENDED);
  }
  const { grant } = result;
  setSessionCookies(c, grant.refreshToken);
  return c.json({ accessToken: grant.accessToken, expiresAt: grant.expiresAt, user: grant.user });
}

// finish the Google sign-in: the browser hands over the one-time code and its PKCE verifier
export async function finishSignIn(c: Context, deps: Deps, limit: KeyLimit): Promise<Response> {
  const auth = guard(c, deps, limit, 20);
  const body = await parseBody(c, AuthSessionReq);
  const result = await auth.exchangeCode(body.code, body.code_verifier);
  if (!result.ok && result.reason === "invalid") {
    clearSessionCookies(c);
    throw new ApiError(400, "sign_in_failed", "Sign-in did not complete. Please try again.");
  }
  return answerWithGrant(c, result);
}

// a new access token and a rotated refresh token in the cookie; each refresh token works once
export async function refreshSession(c: Context, deps: Deps, limit: KeyLimit): Promise<Response> {
  const auth = guard(c, deps, limit, 60);
  const body = await parseBody(c, AuthRefreshReq);
  // the body token only moves an older browser's localStorage session into the cookie, once
  const token = getCookie(c, REFRESH_COOKIE, "secure") ?? body.refresh_token;
  if (!token) {
    clearSessionCookies(c);
    throw new ApiError(401, "session_ended", SESSION_ENDED);
  }
  return answerWithGrant(c, await auth.refresh(token));
}

// revoke the session at Supabase Auth, then clear the cookies; always ends signed out in this browser
export async function logout(c: Context, deps: Deps, limit: KeyLimit): Promise<Response> {
  const auth = guard(c, deps, limit, 20);
  await revoke(auth, bearer(c.req.header("authorization")), getCookie(c, REFRESH_COOKIE, "secure"));
  clearSessionCookies(c);
  return c.body(null, 204);
}
