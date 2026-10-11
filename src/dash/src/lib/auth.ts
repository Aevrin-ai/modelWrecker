/*
  Dashboard sign-in tokens (docs/security/authentication.md). Used only in http mode.

  Google sign-in runs through Supabase Auth with PKCE (the browser proves it started the sign-in, so a
  stolen redirect code is useless). Every token call then goes through the control-plane API
  (/api/v1/auth/*), which keeps the refresh token in an HttpOnly cookie that no script here can read.
  The access token lives only in this module's memory: a reload gets a fresh one with the cookie.
*/

import { singleFlight, type TokenSource } from "@/api/session";
import { API_BASE, SUPABASE_URL } from "@/lib/config";

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export interface AuthSession {
  user: SessionUser;
  accessToken: string;
  /** Unix seconds. */
  expiresAt: number;
}

const VERIFIER_KEY = "aevrin-pkce-verifier";
/** The session an older dashboard kept in localStorage, moved into the cookie once and then deleted. */
const LEGACY_KEY_RE = /^sb-[a-z0-9]+-auth-token(-code-verifier)?$/;
/** Refresh this early, so a request never leaves with a token about to expire. */
const REFRESH_EARLY_S = 60;
const TIMEOUT_MS = 20_000;
const UNAVAILABLE = "Sign-in is not available right now. Please try again.";

let session: AuthSession | null = null;
const listeners = new Set<(next: AuthSession | null) => void>();

function setSession(next: AuthSession | null) {
  session = next;
  for (const listener of listeners) listener(next);
}

export function onSessionChange(listener: (next: AuthSession | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function authCall(path: string, body: unknown = {}, accessToken?: string): Promise<Response> {
  try {
    return await fetch(`${API_BASE}/auth${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Aevrin-Auth": "1", // the API refuses cookie routes without it (cross-site request forgery)
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      credentials: "same-origin",
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error(UNAVAILABLE);
  }
}

/** A session from a token response; null when the API says the session has ended. Throws on an outage. */
async function takeGrant(res: Response): Promise<AuthSession | null> {
  if (res.ok) {
    const data = (await res.json()) as AuthSession;
    if (typeof data?.accessToken !== "string" || typeof data.expiresAt !== "number" || !data.user?.id) throw new Error(UNAVAILABLE);
    const next: AuthSession = { accessToken: data.accessToken, expiresAt: data.expiresAt, user: data.user };
    setSession(next);
    return next;
  }
  if (res.status === 400 || res.status === 401) {
    setSession(null);
    return null;
  }
  throw new Error(UNAVAILABLE);
}

// One refresh at a time in this tab, and across tabs too: every tab shares the one cookie, and a refresh
// token works once, so two tabs refreshing together would otherwise look like reuse.
const refreshNow = singleFlight(async () => {
  const run = async () => takeGrant(await authCall("/refresh"));
  return navigator.locks ? navigator.locks.request("aevrin-auth-refresh", run) : run();
});

/** The API calls' view of the session (src/api/session.ts). */
export const authTokens: TokenSource = {
  async current() {
    if (!session) return null;
    if (session.expiresAt - Date.now() / 1000 > REFRESH_EARLY_S) return session.accessToken;
    return (await refreshNow())?.accessToken ?? null;
  },
  async refresh() {
    return (await refreshNow())?.accessToken ?? null;
  },
  async clear() {
    setSession(null);
  },
};

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Leave for Google. `returnTo` is this app's own address; Supabase Auth only accepts allow-listed ones. */
export async function startGoogleSignIn(returnTo: string): Promise<void> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  sessionStorage.setItem(VERIFIER_KEY, verifier); // throws when storage is blocked: sign-in cannot finish then
  const url = new URL(`${SUPABASE_URL.replace(/\/+$/, "")}/auth/v1/authorize`);
  url.searchParams.set("provider", "google");
  url.searchParams.set("redirect_to", returnTo);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "s256");
  window.location.assign(url.toString());
}

/** Back from Google with a one-time code. Null when sign-in did not complete. */
export async function completeGoogleSignIn(code: string): Promise<AuthSession | null> {
  let verifier: string | null = null;
  try {
    verifier = sessionStorage.getItem(VERIFIER_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);
  } catch {
    /* storage blocked: there is no verifier */
  }
  if (!verifier) return null;
  return takeGrant(await authCall("/session", { code, code_verifier: verifier }));
}

/** The session this browser already has, if any. Only calls the API when there is one to restore. */
export async function restoreSession(): Promise<AuthSession | null> {
  const legacy = takeLegacyRefreshToken();
  if (legacy) {
    const moved = await takeGrant(await authCall("/refresh", { refresh_token: legacy })).catch(() => null);
    if (moved) return moved;
  }
  return /(?:^|;\s*)mw_signed_in=1(?:;|$)/.test(document.cookie) ? refreshNow() : null;
}

/** Revoke the session on the server and clear the cookie. This tab is signed out either way. */
export async function signOut(): Promise<void> {
  const token = session?.accessToken;
  setSession(null);
  await authCall("/logout", {}, token).catch(() => undefined);
}

function takeLegacyRefreshToken(): string | null {
  try {
    let token: string | null = null;
    for (const key of Object.keys(localStorage)) {
      if (!LEGACY_KEY_RE.test(key)) continue;
      try {
        const stored = JSON.parse(localStorage.getItem(key) ?? "null") as { refresh_token?: unknown } | null;
        if (typeof stored?.refresh_token === "string") token = stored.refresh_token;
      } catch {
        /* not a session (the PKCE verifier, or a damaged entry) */
      }
      localStorage.removeItem(key);
    }
    return token;
  } catch {
    return null;
  }
}
