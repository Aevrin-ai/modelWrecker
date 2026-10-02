import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Copy, KeyRound, Loader2, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";
import { AuthFrame } from "@/pages/SignIn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { LOGO_SRC } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { adminClient } from "./client";
import type { MfaStatus } from "./client";

/*
  The admin console's front door (docs/security/admin.md):
    1. Google sign-in (handled by AdminApp), 2. a verified @aevrin.net email, 3. an authenticator code.
  The server enforces all three on every request. This component only walks a staff member through them.
*/

type Stage =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "forbidden"; message: string }
  | { kind: "enroll" }
  | { kind: "verify"; status: MfaStatus }
  | { kind: "recovery-codes"; codes: string[] }
  | { kind: "ready" };

const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.");

export function AdminGate({ children }: { children: ReactNode }) {
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
      .then((s) => active && setStage(s.enrolled ? { kind: "verify", status: s } : { kind: "enroll" }))
      .catch((e: unknown) => {
        if (!active) return;
        const code = (e as { code?: string }).code;
        if (code === "admin_only") setStage({ kind: "forbidden", message: errText(e) });
        else setStage({ kind: "error", message: errText(e) });
      });
    return () => {
      active = false;
    };
  }, [reload]);

  // A request that finds the admin session over sends the user back here.
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
        <Frame title="Checking access">
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" /> One moment...
          </p>
        </Frame>
      );
    case "forbidden":
      return (
        <Frame title="Staff only" icon={<ShieldAlert className="size-5" />}>
          <p className="text-sm text-muted-foreground">{stage.message}</p>
          <p className="text-sm text-muted-foreground">Sign in with your @aevrin.net Google account to continue.</p>
          <SignOutButton />
          <a className="block text-center text-sm underline underline-offset-4" href="/dashboard/">
            Go to the dashboard
          </a>
        </Frame>
      );
    case "error":
      return (
        <Frame title="Admin console unavailable" icon={<ShieldAlert className="size-5" />}>
          <p className="text-sm text-muted-foreground">{stage.message}</p>
          <Button className="w-full" onClick={() => setReload((n) => n + 1)}>
            Try again
          </Button>
          <SignOutButton />
        </Frame>
      );
    case "enroll":
      return <Enroll onDone={(codes) => setStage({ kind: "recovery-codes", codes })} />;
    case "recovery-codes":
      return <RecoveryCodes codes={stage.codes} onDone={() => setStage({ kind: "ready" })} />;
    case "verify":
      return <Verify status={stage.status} onDone={() => setStage({ kind: "ready" })} />;
  }
}

function Frame({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <AuthFrame>
      <div className="flex flex-col items-center gap-3 pb-6">
        <span className="flex size-12 items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-800">
          <img src={LOGO_SRC} alt="Aevrin" className="size-8 object-contain" draggable={false} />
        </span>
        <span className="text-sm font-semibold tracking-tight">Aevrin admin</span>
      </div>
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </AuthFrame>
  );
}

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <Button variant="outline" className="w-full" onClick={() => void signOut()}>
      <LogOut /> Sign out
    </Button>
  );
}

function CodeForm({ onSubmit, allowRecovery }: { onSubmit: (input: { code?: string; recoveryCode?: string }) => Promise<void>; allowRecovery: boolean }) {
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(recovery ? { recoveryCode: code.trim() } : { code: code.replace(/\s/g, "") });
    } catch (err) {
      setError(errText(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={recovery ? "Recovery code" : "6-digit code"} htmlFor="admin-code" error={error}>
        <Input
          id="admin-code"
          autoFocus
          autoComplete="one-time-code"
          inputMode={recovery ? "text" : "numeric"}
          maxLength={recovery ? 32 : 7}
          placeholder={recovery ? "ABCDE-FGHJK" : "123456"}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="text-center font-mono text-lg tracking-widest"
        />
      </Field>
      <Button type="submit" className="w-full" disabled={busy || (recovery ? code.trim().length < 8 : code.replace(/\s/g, "").length !== 6)}>
        {busy && <Loader2 className="animate-spin" />} Continue
      </Button>
      {allowRecovery && (
        <button type="button" className="w-full text-center text-xs text-muted-foreground underline underline-offset-4" onClick={() => setRecovery((r) => !r)}>
          {recovery ? "Use the authenticator app instead" : "Lost your phone? Use a recovery code"}
        </button>
      )}
    </form>
  );
}

function Verify({ status, onDone }: { status: MfaStatus; onDone: () => void }) {
  return (
    <Frame title="Enter your authenticator code" icon={<KeyRound className="size-5" />}>
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
    </Frame>
  );
}

function Enroll({ onDone }: { onDone: (codes: string[]) => void }) {
  const [data, setData] = useState<{ secret: string; qr: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    adminClient
      .enroll()
      .then(async (e) => {
        // Drawn in the browser: the secret never goes to a QR code service.
        const QR = await import("qrcode");
        const qr = await QR.toDataURL(e.otpauthUri, { margin: 1, width: 220 });
        if (active) setData({ secret: e.secret, qr });
      })
      .catch((e: unknown) => active && setError(errText(e)));
    return () => {
      active = false;
    };
  }, []);

  return (
    <Frame title="Set up your authenticator" icon={<ShieldCheck className="size-5" />}>
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
              const s = await adminClient.activate(input.code ?? "");
              onDone(s.recoveryCodes ?? []);
            }}
          />
        </>
      )}
      <SignOutButton />
    </Frame>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <Frame title="Save your recovery codes" icon={<KeyRound className="size-5" />}>
      <p className="text-sm text-muted-foreground">
        If you lose your phone, each of these codes signs you in once. They are shown only now. Keep them in your password manager.
      </p>
      <ol className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3 font-mono text-sm">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <Button variant="outline" className="w-full" onClick={() => void navigator.clipboard?.writeText(codes.join("\n"))}>
        <Copy /> Copy all
      </Button>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I saved these codes
      </label>
      <Button className="w-full" disabled={!saved} onClick={onDone}>
        Open the admin console
      </Button>
    </Frame>
  );
}
