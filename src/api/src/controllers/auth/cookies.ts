import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";

/** `__Secure-mw_rt`: HttpOnly, sent only to these routes, never cross-site. Browsers accept Secure cookies from localhost too. */
export const REFRESH_COOKIE = "mw_rt";
const REFRESH_PATH = "/api/v1/auth";
/** Readable by the landing page, so a signed-in visitor goes straight to the dashboard. Holds no secret. */
const SIGNED_IN_COOKIE = "mw_signed_in";
/** A browser unused for this long signs in again. Every refresh starts the period over. */
const COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;

export function setSessionCookies(c: Context, refreshToken: string): void {
  setCookie(c, REFRESH_COOKIE, refreshToken, {
    prefix: "secure",
    path: REFRESH_PATH,
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    maxAge: COOKIE_MAX_AGE_S,
  });
  setCookie(c, SIGNED_IN_COOKIE, "1", { path: "/", secure: true, sameSite: "Lax", maxAge: COOKIE_MAX_AGE_S });
}

export function clearSessionCookies(c: Context): void {
  deleteCookie(c, REFRESH_COOKIE, { prefix: "secure", path: REFRESH_PATH, secure: true, httpOnly: true, sameSite: "Strict" });
  deleteCookie(c, SIGNED_IN_COOKIE, { path: "/", secure: true, sameSite: "Lax" });
}
