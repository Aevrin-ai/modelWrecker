/*
  Dashboard sign-in state (docs/security/authentication.md).

  http mode: Google sign-in through Supabase Auth with the PKCE flow. Google redirects back to
  /dashboard/?code=..., this provider exchanges the code for a session once (through the API, which
  keeps the refresh token in an HttpOnly cookie), cleans the URL, and returns the user to the page they
  started from. On a normal load it restores the session from that cookie. See lib/auth.ts.
  Aevrin never sees the Google password, and the Google token never reaches a local engine.

  mock mode: there is no real sign-in. `session` stays null, sign-out opens the sign-in screen as a
  preview, and "Continue with Google" goes straight back to the demo workspace.
*/

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_MODE, APP_BASE, IS_HTTP_MODE } from "@/lib/config";
import type { ApiMode } from "@/lib/config";
import {
  completeGoogleSignIn,
  onSessionChange,
  restoreSession,
  signOut as endSession,
  startGoogleSignIn,
  type AuthSession,
  type SessionUser,
} from "@/lib/auth";

interface AuthContextValue {
  mode: ApiMode;
  session: AuthSession | null;
  user: SessionUser | null;
  /** True until the stored session (or an OAuth callback) has been read. Always false in mock mode. */
  loading: boolean;
  /** A safe, plain-language message when the last sign-in attempt failed. */
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE_PATH = APP_BASE; // "/dashboard/", or "/admin/" for the admin console
const RETURN_KEY = "aevrin-return-to";
/** A device user code (XXXX-XXXX). Never mistake one for an OAuth code. */
const USER_CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
/** Router-relative paths we are willing to return to after sign-in. Blocks "//host" and "/\host". */
const SAFE_PATH_RE = /^\/(?![/\\])[A-Za-z0-9\-_/]*(\?[A-Za-z0-9\-_=&%.]*)?$/;

function rememberReturnPath(path: string) {
  try {
    if (SAFE_PATH_RE.test(path) && path !== "/" && !path.startsWith("/login")) sessionStorage.setItem(RETURN_KEY, path);
    else sessionStorage.removeItem(RETURN_KEY);
  } catch {
    /* storage may be blocked; the user lands on the overview instead */
  }
}

function takeReturnPath(): string | null {
  try {
    const path = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return path && SAFE_PATH_RE.test(path) ? path : null;
  } catch {
    return null;
  }
}

interface InitResult {
  session: AuthSession | null;
  error: string | null;
  /** True when this page load was the OAuth callback, so the URL must be cleaned. */
  wasCallback: boolean;
}

// Runs once per page load, even under React StrictMode, because an OAuth code is single use.
let initPromise: Promise<InitResult> | null = null;

async function initAuth(): Promise<InitResult> {
  const url = new URL(window.location.href);
  const atRoot = url.pathname === BASE_PATH || `${url.pathname}/` === BASE_PATH;
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  let error: string | null = null;
  let wasCallback = false;

  if (atRoot) {
    const code = url.searchParams.get("code");
    const oauthFailed =
      url.searchParams.has("error") || url.searchParams.has("error_description") || hash.has("error") || hash.has("error_description");
    if (code && !USER_CODE_RE.test(code)) {
      const session = await completeGoogleSignIn(code).catch(() => null);
      return { session, error: session ? null : "Sign-in did not complete. Please try again.", wasCallback: true };
    }
    if (oauthFailed) {
      wasCallback = true;
      error = "Google sign-in was cancelled or did not complete. Please try again.";
    }
  }

  return { session: await restoreSession(), error, wasCallback };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(IS_HTTP_MODE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!IS_HTTP_MODE) return;
    let active = true;
    const unsubscribe = onSessionChange((next) => {
      if (active) setSession(next);
    });

    initPromise ??= initAuth();
    initPromise
      .then((result) => {
        if (!active) return;
        setSession(result.session);
        setError(result.error);
        if (result.wasCallback) {
          // Drop ?code= from the address bar and go back to where the user started.
          navigate(result.session ? (takeReturnPath() ?? "/") : "/", { replace: true });
        }
      })
      .catch(() => {
        if (active) setError("Sign-in is unavailable right now. Please try again later.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
    // Runs once; navigate is stable for the router's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!IS_HTTP_MODE) {
      navigate("/", { replace: true });
      return;
    }
    setError(null);
    rememberReturnPath(`${location.pathname}${location.search}`);
    try {
      await startGoogleSignIn(`${window.location.origin}${BASE_PATH}`);
    } catch {
      setError("Could not start Google sign-in. Please try again.");
    }
  }, [location.pathname, location.search, navigate]);

  const signOut = useCallback(async () => {
    if (!IS_HTTP_MODE) {
      navigate("/login");
      return;
    }
    navigate("/", { replace: true });
    // Revokes this session on the server and clears the cookie; this tab is signed out either way.
    await endSession();
  }, [navigate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: API_MODE,
      session,
      user: session?.user ?? null,
      loading,
      error,
      signInWithGoogle,
      signOut,
    }),
    [session, loading, error, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
