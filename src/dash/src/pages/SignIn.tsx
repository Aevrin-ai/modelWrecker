import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { AuthFrame } from "./signIn/AuthFrame";
import { BrandLockup } from "./signIn/BrandLockup";
import { GoogleMark } from "./signIn/GoogleMark";

export { AuthFrame } from "./signIn/AuthFrame";
export { AuthLoading } from "./signIn/AuthLoading";

// in http mode it starts Google sign-in; in mock mode it is a preview that opens the demo workspace
export function SignIn() {
  const { mode, error, signInWithGoogle } = useAuth();
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    setStarting(true);
    try {
      await signInWithGoogle();
    } finally {
      // on success the browser leaves for Google; this only matters if starting failed
      setStarting(false);
    }
  }

  return (
    <AuthFrame>
      <div className="rounded-2xl border bg-card p-8 shadow-popover sm:p-10">
        <div className="flex flex-col items-center gap-7 text-center">
          <BrandLockup />

          <div className="space-y-2.5">
            {mode === "mock" && <Badge className="mb-1">Demo mode</Badge>}
            <h1 className="text-2xl font-semibold leading-snug tracking-tight">
              Attack your AI before attackers do.
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to Aevrin to manage your projects, campaigns, and findings.
            </p>
          </div>

          <div className="w-full space-y-4">
            <Button
              variant="outline"
              size="lg"
              className="h-11 w-full text-sm font-medium"
              onClick={handleStart}
              disabled={starting}
            >
              {starting ? <Loader2 className="animate-spin" /> : <GoogleMark />}
              Continue with Google
            </Button>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-left text-sm text-destructive"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}

            {mode === "mock" && (
              <p className="text-xs text-muted-foreground">
                This build runs on sample data, so no real sign-in happens. Continue opens the demo workspace.
              </p>
            )}
          </div>
        </div>
      </div>
    </AuthFrame>
  );
}
