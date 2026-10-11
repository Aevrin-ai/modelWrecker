// Dashboard sign-in tokens (docs/security/authentication.md). Supabase Auth issues and rotates the tokens;
// these routes call it for the browser so the refresh token lives only in an HttpOnly cookie that script
// on the page cannot read. The access token goes back in the JSON body and stays in the page's memory.
import type { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../app";
import { parseBody } from "../body";
import type { AuthTokens, Deps, GrantResult } from "../db";
import { ApiError, RateLimiter, bearer } from "../lib";
import { AuthRefreshReq, AuthSessionReq } from "../schemas";

/** `__Secure-mw_rt`: HttpOnly, sent only to these routes, never cross-site. Browsers accept Secure cookies from localhost too. */
const REFRESH_COOKIE = "mw_rt";
const REFRESH_PATH = "/api/v1/auth";
/** Readable by the landing page, so a signed-in visitor goes straight to the dashboard. Holds no secret. */
const SIGNED_IN_COOKIE = "mw_signed_in";
/** A browser unused for this long signs in again. Every refresh starts the period over. */
const COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;

export function registerAuthRoutes(app: Hono<AppEnv>, deps: Deps) {
  const limiter = new RateLimiter();

  // Cookie-authenticated routes are the one place cross-site request forgery could matter. A custom
  // header cannot be sent cross-site without a CORS preflight, which this API never grants; SameSite=Strict
  // and the Origin check are further layers.
  const guard = (c: Context, max: number) => {
    const origin = c.req.header("origin");
    const site = c.req.header("sec-fetch-site");
    if (c.req.header("x-aevrin-auth") !== "1" || (origin && origin !== deps.appOrigin) || (site && site !== "same-origin")) {
      throw new ApiError(403, "forbidden", "This request is not allowed.");
    }
    const ip = c.req.header("cf-connecting-ip") ?? "local";
    if (!limiter.allow(`auth:${ip}`, max, 60_000, deps.now().getTime())) {
      throw new ApiError(429, "rate_limited", "Too many requests. Slow down and try again.");
    }
    if (!deps.authTokens) throw new ApiError(503, "auth_unavailable", "Sign-in is not available right now.");
    return deps.authTokens;
  };

  const keep = (c: Context, result: GrantResult) => {
    if (!result.ok) {
      // An outage keeps the cookie, so the session survives it; anything else ends the session.
      if (result.reason === "unavailable") throw new ApiError(503, "auth_unavailable", "Sign-in is not available right now. Try again.");
      forget(c);
      throw new ApiError(401, "session_ended", "Your session has ended. Please sign in again.");
    }
    const { grant } = result;
    setCookie(c, REFRESH_COOKIE, grant.refreshToken, {
      prefix: "secure",
      path: REFRESH_PATH,
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      maxAge: COOKIE_MAX_AGE_S,
    });
    setCookie(c, SIGNED_IN_COOKIE, "1", { path: "/", secure: true, sameSite: "Lax", maxAge: COOKIE_MAX_AGE_S });
    return c.json({ accessToken: grant.accessToken, expiresAt: grant.expiresAt, user: grant.user });
  };

  const forget = (c: Context) => {
    deleteCookie(c, REFRESH_COOKIE, { prefix: "secure", path: REFRESH_PATH, secure: true, httpOnly: true, sameSite: "Strict" });
    deleteCookie(c, SIGNED_IN_COOKIE, { path: "/", secure: true, sameSite: "Lax" });
  };

  // Finish the Google sign-in: the browser hands over the one-time code and its PKCE verifier.
  app.post("/auth/session", async (c) => {
    const auth = guard(c, 20);
    const body = await parseBody(c, AuthSessionReq);
    const result = await auth.exchangeCode(body.code, body.code_verifier);
    if (!result.ok && result.reason === "invalid") {
      forget(c);
      throw new ApiError(400, "sign_in_failed", "Sign-in did not complete. Please try again.");
    }
    return keep(c, result);
  });

  // A new access token, and a rotated refresh token in the cookie. Each refresh token works once.
  app.post("/auth/refresh", async (c) => {
    const auth = guard(c, 60);
    const body = await parseBody(c, AuthRefreshReq);
    // The body token only moves an older browser's localStorage session into the cookie, once.
    const token = getCookie(c, REFRESH_COOKIE, "secure") ?? body.refresh_token;
    if (!token) {
      forget(c);
      throw new ApiError(401, "session_ended", "Your session has ended. Please sign in again.");
    }
    return keep(c, await auth.refresh(token));
  });

  // Revoke the session at Supabase Auth, then clear the cookies. Always ends signed out in this browser.
  app.post("/auth/logout", async (c) => {
    const auth = guard(c, 20);
    await revoke(auth, bearer(c.req.header("authorization")), getCookie(c, REFRESH_COOKIE, "secure"));
    forget(c);
    return c.body(null, 204);
  });
}

async function revoke(auth: AuthTokens, accessToken: string | null, refreshToken: string | undefined) {
  if (accessToken && (await auth.signOut(accessToken))) return;
  // The access token had expired: a refresh proves the session and gives a token that can sign it out.
  if (!refreshToken) return;
  const result = await auth.refresh(refreshToken);
  if (result.ok) await auth.signOut(result.grant.accessToken);
}
