import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CloudLocalDiagram } from "@/components/LocalBoundary";
import type { WorkspaceSettings } from "@/types";
import { SyncRow } from "./SyncRow";

export interface PrivacyTabProps {
  settings: WorkspaceSettings;
  detailLocked: boolean;
  onSave: (patch: Partial<WorkspaceSettings>) => Promise<void>;
}

export function PrivacyTab({ settings, detailLocked, onSave }: PrivacyTabProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>What syncs to Aevrin</CardTitle>
          <CardDescription>
            Summary metadata is always on so the dashboard works. Everything sensitive is off by default and stays on
            your machine.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <SyncRow
            title="Summary metadata"
            body="Campaign, run, and finding records: severity, strategy, target name, model, provider, success rate, and timestamps."
            checked
            disabled
            onChange={() => undefined}
          />
          <SyncRow
            title="Detailed evidence"
            body="For each finding: the prompt sent, the model reply, and the judge's verdict, shown on the finding page. Off keeps it in the local runs folder, and turning it off deletes the copies already in the cloud."
            checked={settings.sync.detailedEvidence}
            locked={detailLocked && !settings.sync.detailedEvidence}
            onChange={(checked) => onSave({ sync: { ...settings.sync, detailedEvidence: checked } })}
          />
          <SyncRow
            title="Full attack transcripts"
            body="Every attempt of every run (prompt sent, model reply, result), shown on the campaign page, plus every turn of multi-turn attacks. These can contain your system prompts and private data. Turning it off deletes the copies already in the cloud."
            checked={settings.sync.transcripts}
            locked={detailLocked && !settings.sync.transcripts}
            onChange={(checked) => onSave({ sync: { ...settings.sync, transcripts: checked } })}
          />
          {detailLocked && (
            <p className="pt-4 text-sm text-muted-foreground">
              Evidence and transcript sync are part of Pro. On Free only summary metadata is kept, whatever is switched on
              here.{" "}
              <Link to="/billing" className="font-medium text-foreground underline underline-offset-4">
                See plans
              </Link>
            </p>
          )}
          {(settings.sync.detailedEvidence || settings.sync.transcripts) && (
            <div className="space-y-2 pt-4 text-sm">
              <p className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Sensitive content will leave your machine on the next sync. The engine redacts API keys and
                tokens first, but prompts and replies are sent as they are. Turn this off to keep it local.
              </p>
              <p className="text-muted-foreground">
                Runs you already synced are sent again with the detail the next time you run{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">modelwrecker sync</code> on the
                machine that ran them. To keep one sync metadata only, use{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">modelwrecker sync --metadata-only</code>.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Where your data lives</CardTitle>
          <CardDescription>This picture follows your sync settings above.</CardDescription>
        </CardHeader>
        <CardContent>
          <CloudLocalDiagram evidenceSynced={settings.sync.detailedEvidence || settings.sync.transcripts} />
        </CardContent>
      </Card>
    </>
  );
}
