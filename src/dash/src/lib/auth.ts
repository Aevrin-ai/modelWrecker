// sign-in tokens, http mode only: the refresh token stays in an HttpOnly cookie, the access token only in memory

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
  expiresAt: number; // unix seconds
}

const VERIFIER_KEY = "aevrin-pkce-verifier";
// the session an older dashboard kept in localStorage, moved into the cookie once and then deleted
const LEGACY_KEY_RE = /^sb-[a-z0-9]+-auth-token(-code-verifier)?$/;
// refresh this early, so a request never leaves with a token about to expire
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

// null when the API says the session has ended; throws on an outage
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

// one refresh at a time, across tabs too: they share one cookie and a refresh token works once
const refreshNow = singleFlight(async () => {
  const run = async () => takeGrant(await authCall("/refresh"));
  return navigator.locks ? navigator.locks.request("aevrin-auth-refresh", run) : run();
});

// the API calls' view of the session (src/api/session.ts)
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
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// PKCE: the browser proves it started the sign-in, so a stolen redirect code is useless; returnTo must be allow-listed
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

function takeVerifier(): string | null {
  let verifier: string | null = null;
  try {
    verifier = sessionStorage.getItem(VERIFIER_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);
  } catch {
    // storage blocked: keep whatever was read, which is usually no verifier
    return verifier;
  }
  return verifier;
}

// back from Google with a one-time code; null when sign-in did not complete
export async function completeGoogleSignIn(code: string): Promise<AuthSession | null> {
  const verifier = takeVerifier();
  if (!verifier) return null;
  return takeGrant(await authCall("/session", { code, code_verifier: verifier }));
}

// only calls the API when this browser has a session to restore
export async function restoreSession(): Promise<AuthSession | null> {
  const legacy = takeLegacyRefreshToken();
  if (legacy) {
    const moved = await takeGrant(await authCall("/refresh", { refresh_token: legacy })).catch(() => null);
    if (moved) return moved;
  }
  return /(?:^|;\s*)mw_signed_in=1(?:;|$)/.test(document.cookie) ? refreshNow() : null;
}

// revokes the session on the server and clears the cookie; this tab is signed out either way
export async function signOut(): Promise<void> {
  const token = session?.accessToken;
  setSession(null);
  await authCall("/logout", {}, token).catch(() => undefined);
}

function readLegacyRefreshToken(key: string): string | null {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? "null") as { refresh_token?: unknown } | null;
    return typeof stored?.refresh_token === "string" ? stored.refresh_token : null;
  } catch {
    // not a session: the PKCE verifier, or a damaged entry
    return null;
  }
}

function takeLegacyRefreshToken(): string | null {
  try {
    let token: string | null = null;
    for (const key of Object.keys(localStorage)) {
      if (!LEGACY_KEY_RE.test(key)) continue;
      const found = readLegacyRefreshToken(key);
      if (found !== null) token = found;
      localStorage.removeItem(key);
    }
    return token;
  } catch {
    return null;
  }
}
