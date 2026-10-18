import { Pencil, Play, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampaignStatusBadge } from "@/components/StatusBadges";
import type { CampaignStatus } from "@/types";

export interface CampaignActionsProps {
  status: CampaignStatus;
  canMarkReady: boolean;
  canUnmark: boolean;
  busy: boolean;
  onToggleReady: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function CampaignActions({ status, canMarkReady, canUnmark, busy, onToggleReady, onRename, onDelete }: CampaignActionsProps) {
  return (
    <>
      <CampaignStatusBadge status={status} />
      {canMarkReady && (
        <Button onClick={onToggleReady} disabled={busy}>
          <Play /> Mark ready for engine
        </Button>
      )}
      {canUnmark && (
        <Button variant="outline" onClick={onToggleReady} disabled={busy}>
          <Undo2 /> Back to draft
        </Button>
      )}
      <Button variant="outline" size="icon" onClick={onRename} aria-label="Rename campaign">
        <Pencil />
      </Button>
      <Button variant="outline" size="icon" onClick={onDelete} aria-label="Delete campaign">
        <Trash2 />
      </Button>
    </>
  );
}
