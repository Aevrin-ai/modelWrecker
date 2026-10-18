import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { nameSchema } from "./dialogSchemas";
import { FormActions } from "./FormActions";
import { errorText } from "./formErrors";

export interface RenameDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  initial: string;
  label?: string;
  onSave: (name: string) => Promise<void>;
}

export function RenameDialog({ open, onClose, title, initial, label = "Name", onSave }: RenameDialogProps) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setName(initial);
      setError(null);
    }
  }, [open, initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      await onSave(parsed.data);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form id="rename-form" onSubmit={handleSubmit} className="space-y-4 pb-4">
        <Field label={label} htmlFor="rename-input" error={error}>
          <Input id="rename-input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <FormActions isBusy={busy} submitLabel={busy ? "Saving..." : "Save"} onClose={onClose} />
      </form>
    </Dialog>
  );
}
