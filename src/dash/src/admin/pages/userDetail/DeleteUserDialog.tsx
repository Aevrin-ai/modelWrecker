import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { ActionDialog } from "../../ActionDialog";
import { adminClient } from "../../client";
import type { UserDetail as Detail } from "../../client";

export interface DeleteUserDialogProps {
  user: Detail;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteUserDialog({ user, open, onClose, onDeleted }: DeleteUserDialogProps) {
  const [confirm, setConfirm] = useState("");

  return (
    <ActionDialog
      open={open}
      onClose={() => {
        setConfirm("");
        onClose();
      }}
      title="Delete user"
      description="Permanently deletes the account and everything it owns: projects, targets, campaigns, runs, findings, evidence, devices, and settings. Payment records are kept for accounting, detached from the account. This cannot be undone."
      destructive
      confirmLabel="Delete permanently"
      canSubmit={confirm.trim().toLowerCase() === user.email.toLowerCase()}
      onSubmit={async (reason) => {
        await adminClient.deleteUser(user.id, confirm.trim(), reason);
        onDeleted();
      }}
    >
      <Field label={`Type ${user.email} to confirm`} htmlFor="adm-del">
        <Input id="adm-del" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
      </Field>
    </ActionDialog>
  );
}
