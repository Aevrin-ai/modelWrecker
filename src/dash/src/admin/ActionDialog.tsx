import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";

/**
 * Every admin change goes through this dialog: extra fields from the caller, plus a required reason that
 * the server writes to the audit log with the admin's email and the time.
 */
export function ActionDialog({
  open,
  onClose,
  title,
  description,
  children,
  confirmLabel,
  destructive,
  canSubmit = true,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  canSubmit?: boolean;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      description={typeof description === "string" ? description : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={() => void go()} disabled={busy || !canSubmit || reason.trim().length < 3}>
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {typeof description !== "string" && description}
        {children}
        <Field label="Reason" htmlFor="admin-reason" hint="Required. Saved in the audit log with your email." error={error}>
          <Textarea id="admin-reason" rows={2} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="Why are you making this change?" />
        </Field>
      </div>
    </Dialog>
  );
}
