import { useState } from "react";
import { Checkbox } from "@/components/ui/field";
import { ActionDialog } from "../../ActionDialog";
import { adminClient } from "../../client";
import type { UserDialogProps } from "./userDetailAction";

export function SyncDialog({ user, open, onClose, onDone }: UserDialogProps) {
  const [sync, setSync] = useState(user.settings.sync);

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Sync settings"
      description="Turning a setting off deletes the copies already in the cloud. The user's local runs keep the originals."
      confirmLabel="Save settings"
      onSubmit={async (reason) => {
        await adminClient.setSync(user.id, sync, reason);
        onDone("Sync settings saved");
      }}
    >
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={sync.detailedEvidence} onChange={(checked) => setSync({ ...sync, detailedEvidence: checked })} /> Detailed evidence
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={sync.transcripts} onChange={(checked) => setSync({ ...sync, transcripts: checked })} /> Full attack transcripts
      </label>
    </ActionDialog>
  );
}
