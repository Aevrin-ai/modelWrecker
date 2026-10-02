import { useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Loader2, Moon, ShieldCheck, Sun } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LOGO_SRC } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

/** Google "G" mark, the standard multi-color glyph used on Google sign-in buttons. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58V6.6H1.28a12 12 0 0 0 0 10.8l4.01-3.11Z" />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.53 11.53 0 0 0 12 0 12 12 0 0 0 1.28 6.6l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}

/** Full-height centered frame shared by the sign-in, loading, and configuration screens. */
export function AuthFrame({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  return (
    <div className="relative flex min-h-full w-full items-center justify-center overflow-y-auto bg-muted/40 px-4 py-10">
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle theme"
        className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {theme === "dark" ? <Sun className="size-[1.15rem]" /> : <Moon className="size-[1.15rem]" />}
      </button>
      <div className="w-full max-w-sm animate-fade-in">{children}</div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex flex-col items-center gap-3 pb-6">
      <span className="flex size-12 items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-800">
        <img src={LOGO_SRC} alt="Aevrin" className="size-8 object-contain" draggable={false} />
      </span>
      <span className="text-sm font-semibold tracking-tight">Aevrin</span>
    </div>
  );
}

/** Shown in http mode while the stored session or the Google callback is read. */
export function AuthLoading() {
  return (
    <AuthFrame>
      <BrandMark />
      <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" /> Checking your session...
      </p>
    </AuthFrame>
  );
}

/**
 * The sign-in screen. In http mode it starts Google sign-in through Supabase Auth. In mock mode it is
 * a preview: "Continue" opens the demo workspace and no real sign-in happens.
 */
export function SignIn() {
  const { mode, error, signInWithGoogle } = useAuth();
  const [starting, setStarting] = useState(false);

  async function start() {
    setStarting(true);
    try {
      await signInWithGoogle();
    } finally {
      // On success the browser leaves for Google; this only matters if starting failed.
      setStarting(false);
    }
  }

  return (
    <AuthFrame>
      <BrandMark />
      <Card>
        <CardHeader className="items-center text-center">
          {mode === "mock" && <Badge className="mb-1">Demo mode</Badge>}
          <CardTitle className="text-xl font-semibold">Sign in to Aevrin</CardTitle>
          <CardDescription>Manage ModelWrecker projects, campaigns, findings, and devices.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" size="lg" className="w-full" onClick={start} disabled={starting}>
            {starting ? <Loader2 className="animate-spin" /> : <GoogleMark />}
            Continue with Google
          </Button>
          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
          {mode === "mock" && (
            <p className="text-center text-xs text-muted-foreground">
              This build runs on sample data, so no real sign-in happens. Continue opens the demo workspace.
            </p>
          )}
        </CardContent>
      </Card>
      <p className="mt-6 px-2 text-center text-xs text-muted-foreground">
        <ShieldCheck className="mr-1.5 inline size-3.5 -translate-y-px align-middle" />
        Google confirms who you are. Aevrin never sees your Google password.
      </p>
    </AuthFrame>
  );
}
