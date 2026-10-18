// the admin session lives in sessionStorage, so it ends when the tab closes; the server is the real control
const SESSION_KEY = "aevrin-admin-session";

let memorySession: string | null = null;

// the gate never catches this: it listens for the "aevrin-admin-session-ended" event sent just before the throw
class AdminSessionRequired extends Error {}

function readStoredSession(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function storeSession(token: string | null) {
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, token);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // storage blocked: the in-memory copy keeps the session for this page only
    return;
  }
}

export function currentSession(): string | null {
  return readStoredSession() ?? memorySession;
}

export function keepSession(token: string) {
  memorySession = token;
  storeSession(token);
}

export function clearSession() {
  memorySession = null;
  storeSession(null);
}

export function sessionEnded(message: string): never {
  clearSession();
  window.dispatchEvent(new Event("aevrin-admin-session-ended"));
  throw new AdminSessionRequired(message);
}
