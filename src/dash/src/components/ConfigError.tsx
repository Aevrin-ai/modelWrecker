import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoTile } from "@/components/Logo";
import { AuthFrame } from "@/pages/SignIn";
import { CONFIG_PROBLEMS } from "@/lib/config";

/**
 * Shown instead of the app when this build asks for the live API (VITE_API_MODE=http) but the
 * sign-in settings are missing or invalid. It names the variables, never their values, and never
 * shows a stack trace.
 */
export function ConfigError() {
  return (
    <AuthFrame>
      <div className="flex justify-center pb-6">
        <LogoTile size="lg" />
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5 shrink-0" />
            <CardTitle className="text-lg font-semibold">The dashboard is not configured</CardTitle>
          </div>
          <CardDescription>
            This build is set to use the live API, but the sign-in settings are missing. Set these build-time
            variables and build again:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ul className="space-y-2">
            {CONFIG_PROBLEMS.map((p) => (
              <li key={p} className="rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">
                {p}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            Both values are public (the Supabase project URL and anon key). To run the demo on sample data
            instead, leave <span className="font-mono text-xs">VITE_API_MODE</span> unset.
          </p>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}
