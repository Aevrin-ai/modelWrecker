// dashboard sign-in state (docs/security/authentication.md); in mock mode there is no real sign-in

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
  loading: boolean; // true until the stored session or an OAuth callback is read; always false in mock mode
  error: string | null; // a safe, plain-language message when the last sign-in failed
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE_PATH = APP_BASE; // the dashboard base, or the admin console base
const RETURN_KEY = "aevrin-return-to";
// a device user code (XXXX-XXXX), never to be mistaken for an OAuth code
const USER_CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
// router-relative paths safe to return to after sign-in; blocks "//host" and "/\host"
const SAFE_PATH_RE = /^\/(?![/\\])[A-Za-z0-9\-_/]*(\?[A-Za-z0-9\-_=&%.]*)?$/;

function rememberReturnPath(path: string) {
  try {
    if (SAFE_PATH_RE.test(path) && path !== "/" && !path.startsWith("/login")) sessionStorage.setItem(RETURN_KEY, path);
    else sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // storage may be blocked; the user lands on the overview instead
    return;
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
  wasCallback: boolean; // this load was the OAuth callback, so the URL must be cleaned
}

// runs once per page load, even under React StrictMode, because an OAuth code is single use
let initPromise: Promise<InitResult> | null = null;

// the code is exchanged through the API, which keeps the refresh token in an HttpOnly cookie script cannot read
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
          // drop ?code= from the address bar and go back to where the user started
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once; navigate is stable for the router's lifetime
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
    // revokes this session on the server and clears the cookie; this tab is signed out either way
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
