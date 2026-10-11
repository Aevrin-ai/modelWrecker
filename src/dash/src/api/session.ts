/*
  What a request does when the API rejects its access token (docs/security/authentication.md).

  Supabase Auth keeps the session: a short-lived access token and a refresh token it rotates on every
  use. The client already refreshes ahead of expiry, so a rejected token is rare: a tab that slept past
  expiry, or a clock that is off. Then the request refreshes the session once and retries once. Requests
  rejected together share one refresh. If the refresh fails, the session has ended: this browser is
  signed out and the caller shows the sign-in screen. Nothing here can loop.

  Kept free of imports so it can be tested without a browser or a network.
*/

export interface TokenSource {
  /** The current access token, or null when there is no session. */
  current(): Promise<string | null>;
  /** Forces a refresh. Null when the refresh session is gone (expired, revoked, or reused). */
  refresh(): Promise<string | null>;
  /** Drops the session in this browser. */
  clear(): Promise<void>;
}

/** Concurrent callers share the one call in flight; the next call after it settles starts a new one. */
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    inFlight ??= fn().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}

/** True when the API said the access token is missing, expired, or invalid. */
async function tokenRejected(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  try {
    const body: unknown = await res.clone().json();
    return typeof body === "object" && body !== null && (body as { error?: unknown }).error === "unauthenticated";
  } catch {
    return false;
  }
}

/**
 * Sends with the current token; on a rejected token, refreshes once and retries once.
 * Returns null when the session has ended (the browser is already signed out).
 */
export async function sendWithSession(
  tokens: TokenSource,
  send: (token: string) => Promise<Response>,
): Promise<Response | null> {
  const token = await tokens.current();
  if (!token) return ended(tokens);
  const res = await send(token);
  if (!(await tokenRejected(res))) return res;

  // Another request may have refreshed already; use its token instead of rotating again.
  const latest = await tokens.current();
  const next = latest && latest !== token ? latest : await tokens.refresh();
  if (!next) return ended(tokens);
  const retry = await send(next);
  return (await tokenRejected(retry)) ? ended(tokens) : retry;
}

async function ended(tokens: TokenSource): Promise<null> {
  await tokens.clear().catch(() => undefined);
  return null;
}
