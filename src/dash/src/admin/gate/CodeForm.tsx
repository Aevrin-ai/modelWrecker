import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { errorText } from "./errorText";

export interface CodeFormProps {
  onSubmit: (input: { code?: string; recoveryCode?: string }) => Promise<void>;
  allowRecovery: boolean;
}

export function CodeForm({ onSubmit, allowRecovery }: CodeFormProps) {
  const [code, setCode] = useState("");
  const [isRecovery, setIsRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(isRecovery ? { recoveryCode: code.trim() } : { code: code.replace(/\s/g, "") });
    } catch (err) {
      setError(errorText(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label={isRecovery ? "Recovery code" : "6-digit code"} htmlFor="admin-code" error={error}>
        <Input
          id="admin-code"
          autoFocus
          autoComplete="one-time-code"
          inputMode={isRecovery ? "text" : "numeric"}
          maxLength={isRecovery ? 32 : 7}
          placeholder={isRecovery ? "ABCDE-FGHJK" : "123456"}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="text-center font-mono text-lg tracking-widest"
        />
      </Field>
      <Button type="submit" className="w-full" disabled={busy || (isRecovery ? code.trim().length < 8 : code.replace(/\s/g, "").length !== 6)}>
        {busy && <Loader2 className="animate-spin" />} Continue
      </Button>
      {allowRecovery && (
        <button type="button" className="w-full text-center text-xs text-muted-foreground underline underline-offset-4" onClick={() => setIsRecovery((wasRecovery) => !wasRecovery)}>
          {isRecovery ? "Use the authenticator app instead" : "Lost your phone? Use a recovery code"}
        </button>
      )}
    </form>
  );
}
