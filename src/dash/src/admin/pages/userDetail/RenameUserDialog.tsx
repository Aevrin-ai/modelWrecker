import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { ActionDialog } from "../../ActionDialog";
import { adminClient } from "../../client";
import type { UserDialogProps } from "./userDetailAction";

export function RenameUserDialog({ user, open, onClose, onDone }: UserDialogProps) {
  const [name, setName] = useState(user.name);

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Rename user"
      confirmLabel="Save name"
      canSubmit={name.trim().length > 0}
      onSubmit={async (reason) => {
        await adminClient.rename(user.id, name.trim(), reason);
        onDone("Name saved");
      }}
    >
      <Field label="Display name" htmlFor="adm-name">
        <Input id="adm-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
      </Field>
    </ActionDialog>
  );
}
