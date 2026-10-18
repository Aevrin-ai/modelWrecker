import { KeyRound } from "lucide-react";
import { adminClient } from "../client";
import type { MfaStatus } from "../client";
import { CodeForm } from "./CodeForm";
import { GateFrame } from "./GateFrame";
import { SignOutButton } from "./SignOutButton";

export interface VerifyCodeProps {
  status: MfaStatus;
  onDone: () => void;
}

export function VerifyCode({ status, onDone }: VerifyCodeProps) {
  return (
    <GateFrame title="Enter your authenticator code" icon={<KeyRound className="size-5" />}>
      <p className="text-sm text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{status.email}</span>. Open your authenticator app and enter the code for Aevrin Admin.
      </p>
      {status.locked && <p className="text-sm text-destructive">Too many wrong codes. Wait 15 minutes, then try again.</p>}
      <CodeForm
        allowRecovery
        onSubmit={async (input) => {
          await adminClient.verify(input);
          onDone();
        }}
      />
      <SignOutButton />
    </GateFrame>
  );
}
