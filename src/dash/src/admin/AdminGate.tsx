import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminClient } from "./client";
import type { MfaStatus } from "./client";
import { EnrollAuthenticator } from "./gate/EnrollAuthenticator";
import { errorText } from "./gate/errorText";
import { GateFrame } from "./gate/GateFrame";
import { RecoveryCodes } from "./gate/RecoveryCodes";
import { SignOutButton } from "./gate/SignOutButton";
import { VerifyCode } from "./gate/VerifyCode";

// walks staff through Google sign-in, a staff email, then an authenticator code; the server enforces all three

type Stage =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "forbidden"; message: string }
  | { kind: "enroll" }
  | { kind: "verify"; status: MfaStatus }
  | { kind: "recovery-codes"; codes: string[] }
  | { kind: "ready" };

export interface AdminGateProps {
  children: ReactNode;
}

export function AdminGate({ children }: AdminGateProps) {
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    if (adminClient.hasSession()) {
      setStage({ kind: "ready" });
      return;
    }
    adminClient
      .mfaStatus()
      .then((status) => active && setStage(status.enrolled ? { kind: "verify", status } : { kind: "enroll" }))
      .catch((e: unknown) => {
        if (!active) return;
        const code = (e as { code?: string }).code;
        if (code === "admin_only") setStage({ kind: "forbidden", message: errorText(e) });
        else setStage({ kind: "error", message: errorText(e) });
      });
    return () => {
      active = false;
    };
  }, [reload]);

  // a request that finds the admin session over sends the user back here
  useEffect(() => {
    const onExpired = () => setReload((n) => n + 1);
    window.addEventListener("aevrin-admin-session-ended", onExpired);
    return () => window.removeEventListener("aevrin-admin-session-ended", onExpired);
  }, []);

  switch (stage.kind) {
    case "ready":
      return <>{children}</>;
    case "loading":
      return (
        <GateFrame title="Checking access">
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" /> One moment...
          </p>
        </GateFrame>
      );
    case "forbidden":
      return (
        <GateFrame title="Staff only" icon={<ShieldAlert className="size-5" />}>
          <p className="text-sm text-muted-foreground">{stage.message}</p>
          <p className="text-sm text-muted-foreground">Sign in with your @aevrin.net Google account to continue.</p>
          <SignOutButton />
          <a className="block text-center text-sm underline underline-offset-4" href="/dashboard/">
            Go to the dashboard
          </a>
        </GateFrame>
      );
    case "error":
      return (
        <GateFrame title="Admin console unavailable" icon={<ShieldAlert className="size-5" />}>
          <p className="text-sm text-muted-foreground">{stage.message}</p>
          <Button className="w-full" onClick={() => setReload((n) => n + 1)}>
            Try again
          </Button>
          <SignOutButton />
        </GateFrame>
      );
    case "enroll":
      return <EnrollAuthenticator onDone={(codes) => setStage({ kind: "recovery-codes", codes })} />;
    case "recovery-codes":
      return <RecoveryCodes codes={stage.codes} onDone={() => setStage({ kind: "ready" })} />;
    case "verify":
      return <VerifyCode status={stage.status} onDone={() => setStage({ kind: "ready" })} />;
  }
}
