// what a request does when its access token is rejected (docs/security/authentication.md); no imports, so Node tests it

export interface TokenSource {
  current(): Promise<string | null>; // null when there is no session
  refresh(): Promise<string | null>; // null when the refresh session is expired, revoked, or reused
  clear(): Promise<void>; // drops the session in this browser
}

// concurrent callers share the one call in flight; the next call after it settles starts a new one
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    inFlight ??= fn().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}

async function tokenRejected(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  try {
    const body: unknown = await res.clone().json();
    return typeof body === "object" && body !== null && (body as { error?: unknown }).error === "unauthenticated";
  } catch {
    return false;
  }
}

// refreshes once and retries once, so nothing loops; null means the session ended and the browser is signed out
export async function sendWithSession(
  tokens: TokenSource,
  send: (token: string) => Promise<Response>,
): Promise<Response | null> {
  const token = await tokens.current();
  if (!token) return ended(tokens);
  const res = await send(token);
  if (!(await tokenRejected(res))) return res;

  // another request may have refreshed already; use its token instead of rotating again
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
