/*
  Dashboard sign-in state (docs/security/authentication.md).

  http mode: Google sign-in through Supabase Auth with the PKCE flow. Google redirects back to
  /dashboard/?code=..., this provider exchanges the code for a session once, cleans the URL, and
  returns the user to the page they started from. The session (a short-lived access token plus a
  refresh token) is kept by the Supabase client; the HTTP client reads a fresh token per request.
  Aevrin never sees the Google password, and the Google token never reaches a local engine.

  mock mode: there is no real sign-in. `session` stays null, sign-out opens the sign-in screen as a
  preview, and "Continue with Google" goes straight back to the demo workspace.
*/

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Session, User } from "@supabase/supabase-js";
import { API_MODE, IS_HTTP_MODE } from "@/lib/config";
import type { ApiMode } from "@/lib/config";
import { getSupabase } from "@/lib/supabase";

interface AuthContextValue {
  mode: ApiMode;
  session: Session | null;
  user: User | null;
  /** True until the stored session (or an OAuth callback) has been read. Always false in mock mode. */
  loading: boolean;
  /** A safe, plain-language message when the last sign-in attempt failed. */
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE_PATH = import.meta.env.BASE_URL; // "/dashboard/"
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
  session: Session | null;
  error: string | null;
  /** True when this page load was the OAuth callback, so the URL must be cleaned. */
  wasCallback: boolean;
}

// Runs once per page load, even under React StrictMode, because an OAuth code is single use.
let initPromise: Promise<InitResult> | null = null;

async function initAuth(): Promise<InitResult> {
  const sb = await getSupabase();
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
      wasCallback = true;
      const { error: exchangeError } = await sb.auth.exchangeCodeForSession(code);
      if (exchangeError) error = "Sign-in did not complete. Please try again.";
    } else if (oauthFailed) {
      wasCallback = true;
      error = "Google sign-in was cancelled or did not complete. Please try again.";
    }
  }

  const { data } = await sb.auth.getSession();
  return { session: data.session, error, wasCallback };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(IS_HTTP_MODE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!IS_HTTP_MODE) return;
    let active = true;
    let unsubscribe: (() => void) | null = null;

    initPromise ??= initAuth();
    initPromise
      .then(async (result) => {
        if (!active) return;
        setSession(result.session);
        setError(result.error);
        if (result.wasCallback) {
          // Drop ?code= from the address bar and go back to where the user started.
          navigate(result.session ? (takeReturnPath() ?? "/") : "/", { replace: true });
        }
        const sb = await getSupabase();
        if (!active) return;
        const { data } = sb.auth.onAuthStateChange((_event, next) => setSession(next));
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch(() => {
        if (active) setError("Sign-in is unavailable right now. Please try again later.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe?.();
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
      const sb = await getSupabase();
      const { error: oauthError } = await sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${BASE_PATH}` },
      });
      if (oauthError) setError("Could not start Google sign-in. Please try again.");
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
    try {
      const sb = await getSupabase();
      // Revokes the refresh token on the server. If that call fails, still clear this browser.
      const { error: outError } = await sb.auth.signOut();
      if (outError) await sb.auth.signOut({ scope: "local" });
    } catch {
      /* the client could not load; there is no session to clear */
    }
    setSession(null);
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
