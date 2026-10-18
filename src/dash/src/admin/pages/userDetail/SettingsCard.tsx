import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserDetail as Detail } from "../../client";
import { DetailRow } from "./DetailRow";

export interface SettingsCardProps {
  user: Detail;
  onEdit: () => void;
}

export function SettingsCard({ user, onEdit }: SettingsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync settings</CardTitle>
        <CardDescription>What this account sends beyond summary metadata. Turning one off deletes the cloud copies.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <DetailRow label="Detailed evidence">{user.settings.sync.detailedEvidence ? "On" : "Off"}</DetailRow>
        <DetailRow label="Full attack transcripts">{user.settings.sync.transcripts ? "On" : "Off"}</DetailRow>
        {!user.subscription.features.evidence_storage && <p className="text-xs text-muted-foreground">Not kept on this plan (Pro feature), whatever is set here.</p>}
        <Button className="mt-2 w-full" variant="outline" onClick={onEdit}>
          Change sync settings
        </Button>
      </CardContent>
    </Card>
  );
}
