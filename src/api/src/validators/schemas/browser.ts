// bodies the browser sends without a user token: the page beacon and the dashboard sign-in
import { z } from "zod";

/** The page analytics beacon (docs/analytics/page-analytics.md): site, path, referrer. */
export const CollectReq = z
  .object({
    s: z.enum(["landing", "dashboard"]),
    p: z.string().max(500),
    r: z.string().max(1000).default(""),
  })
  .strict();

/** The Google sign-in's one-time code and its PKCE verifier (RFC 7636: 43-128 unreserved characters). */
export const AuthSessionReq = z
  .object({
    code: z.string().regex(/^[A-Za-z0-9._~-]{1,512}$/),
    code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
  })
  .strict();

/** Empty, or once per browser: the refresh token an older dashboard kept in localStorage. */
export const AuthRefreshReq = z
  .object({ refresh_token: z.string().regex(/^[A-Za-z0-9._-]{8,512}$/).optional() })
  .strict();
