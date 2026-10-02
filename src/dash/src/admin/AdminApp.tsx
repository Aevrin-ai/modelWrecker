import { Suspense, lazy, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { AuthFrame, AuthLoading } from "@/pages/SignIn";
import { SkeletonCards } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { AdminGate } from "./AdminGate";
import { AdminShell } from "./AdminShell";

// Staff console at app.aevrin.net/admin (docs/security/admin.md). Same build as the dashboard; this chunk
// loads only under /admin/. Access is decided by the API on every request, not by this component.

const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const Users = page(() => import("./pages/Users"), "Users");
const UserDetail = page(() => import("./pages/UserDetail"), "UserDetail");
const Payments = page(() => import("./pages/Payments"), "Payments");
const Audit = page(() => import("./pages/Audit"), "Audit");
const PlatformAnalytics = page(() => import("./pages/PlatformAnalytics"), "PlatformAnalytics");
const Traffic = page(() => import("./pages/Traffic"), "Traffic");

export function AdminApp() {
  const { mode, session, loading } = useAuth();
  if (mode === "http") {
    if (loading) return <AuthLoading />;
    if (!session) return <AdminSignIn />;
  }
  return (
    <AdminGate>
      <Suspense fallback={<SkeletonCards count={4} className="sm:grid-cols-2 lg:grid-cols-4" />}>
        <Routes>
          <Route element={<AdminShell />}>
            <Route index element={<Navigate to="/users" replace />} />
            <Route path="users" element={<Users />} />
            <Route path="users/:id" element={<UserDetail />} />
            <Route path="payments" element={<Payments />} />
            <Route path="audit" element={<Audit />} />
            <Route path="analytics" element={<PlatformAnalytics />} />
            <Route path="traffic" element={<Traffic />} />
            <Route path="*" element={<Navigate to="/users" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </AdminGate>
  );
}

function AdminSignIn() {
  const { error, signInWithGoogle } = useAuth();
  const [starting, setStarting] = useState(false);
  return (
    <AuthFrame>
      <Card>
        <CardHeader className="space-y-1 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-md bg-muted">
            <ShieldCheck className="size-5" />
          </span>
          <CardTitle className="text-xl">Aevrin admin console</CardTitle>
          <CardDescription>For Aevrin staff. Sign in with your @aevrin.net Google account; you will then need your authenticator app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            className="w-full"
            disabled={starting}
            onClick={async () => {
              setStarting(true);
              await signInWithGoogle();
              setStarting(false);
            }}
          >
            {starting && <Loader2 className="animate-spin" />} Continue with Google
          </Button>
          <a className="block text-center text-xs text-muted-foreground underline underline-offset-4" href="/dashboard/">
            Looking for your dashboard?
          </a>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}
