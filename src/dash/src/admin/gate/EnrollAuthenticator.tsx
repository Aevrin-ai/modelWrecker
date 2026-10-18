import { useEffect, useState } from "react";
import { Copy, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardDescription } from "@/components/ui/card";
import { adminClient } from "../client";
import { CodeForm } from "./CodeForm";
import { errorText } from "./errorText";
import { GateFrame } from "./GateFrame";
import { SignOutButton } from "./SignOutButton";

export interface EnrollAuthenticatorProps {
  onDone: (codes: string[]) => void;
}

export function EnrollAuthenticator({ onDone }: EnrollAuthenticatorProps) {
  const [data, setData] = useState<{ secret: string; qr: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    adminClient
      .enroll()
      .then(async (enrollment) => {
        // drawn in the browser, so the secret never goes to a QR code service
        const qrCodeModule = await import("qrcode");
        const qrDataUrl = await qrCodeModule.toDataURL(enrollment.otpauthUri, { margin: 1, width: 220 });
        if (active) setData({ secret: enrollment.secret, qr: qrDataUrl });
      })
      .catch((e: unknown) => active && setError(errorText(e)));
    return () => {
      active = false;
    };
  }, []);

  return (
    <GateFrame title="Set up your authenticator" icon={<ShieldCheck className="size-5" />}>
      <CardDescription>
        The admin console needs a second factor. Scan this with Google Authenticator, Microsoft Authenticator, 1Password, or any TOTP app, then enter
        the code it shows.
      </CardDescription>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!data && !error && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Preparing...
        </p>
      )}
      {data && (
        <>
          <div className="flex justify-center rounded-md bg-white p-3">
            <img src={data.qr} alt="Authenticator setup QR code" className="size-[200px]" />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Can't scan? Enter this setup key:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-muted px-2 py-1.5 font-mono text-xs">{data.secret.replace(/(.{4})/g, "$1 ").trim()}</code>
              <Button variant="ghost" size="icon" aria-label="Copy setup key" onClick={() => void navigator.clipboard?.writeText(data.secret)}>
                <Copy />
              </Button>
            </div>
          </div>
          <CodeForm
            allowRecovery={false}
            onSubmit={async (input) => {
              const session = await adminClient.activate(input.code ?? "");
              onDone(session.recoveryCodes ?? []);
            }}
          />
        </>
      )}
      <SignOutButton />
    </GateFrame>
  );
}
