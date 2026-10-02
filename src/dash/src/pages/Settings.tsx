import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Lock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataState, SkeletonCards } from "@/components/States";
import { CloudLocalDiagram } from "@/components/LocalBoundary";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import { useTheme } from "@/hooks/useTheme";
import type { NotificationItem, WorkspaceSettings } from "@/types";

const NOTIFICATION_LABEL: Record<NotificationItem["kind"], string> = {
  campaign_completed: "A campaign completes",
  critical_finding: "A new critical finding is verified",
  device_connected: "A device connects",
  device_disconnected: "A device goes offline",
  sync_failed: "A sync fails",
  new_version: "A new engine version is available",
  subscription_changed: "Your subscription changes",
};

export function Settings() {
  const { toast } = useToast();
  const { theme, toggle } = useTheme();
  const settings = useAsync(() => apiClient.getSettings(), []);
  const [draft, setDraft] = useState<WorkspaceSettings | null>(null);

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  async function save(patch: Partial<WorkspaceSettings>) {
    if (!draft) return;
    const next = { ...draft, ...patch };
    setDraft(next);
    try {
      await apiClient.updateSettings(patch);
      toast({ title: "Settings saved" });
    } catch {
      setDraft(draft);
      toast({ title: "Could not save settings", tone: "error" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Workspace preferences. The local engine reads the sync settings before it uploads anything." />
      <DataState
        loading={settings.loading}
        error={settings.error}
        data={draft}
        onRetry={settings.refetch}
        errorTitle="Unable to load settings."
        skeleton={<SkeletonCards count={2} />}
      >
        {(s) => (
          <Tabs defaultValue="privacy">
            <TabsList>
              <TabsTrigger value="privacy">Privacy and sync</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
            </TabsList>

            <TabsContent value="privacy" className="space-y-4">
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
                    checked={s.sync.detailedEvidence}
                    onChange={(v) => save({ sync: { ...s.sync, detailedEvidence: v } })}
                  />
                  <SyncRow
                    title="Full attack transcripts"
                    body="Every attempt of every run (prompt sent, model reply, result), shown on the campaign page, plus every turn of multi-turn attacks. These can contain your system prompts and private data. Turning it off deletes the copies already in the cloud."
                    checked={s.sync.transcripts}
                    onChange={(v) => save({ sync: { ...s.sync, transcripts: v } })}
                  />
                  {(s.sync.detailedEvidence || s.sync.transcripts) && (
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
                  <CloudLocalDiagram evidenceSynced={s.sync.detailedEvidence || s.sync.transcripts} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Notify me when</CardTitle>
                  <CardDescription>In-dashboard notifications for events the control plane receives.</CardDescription>
                </CardHeader>
                <CardContent className="divide-y">
                  {(Object.keys(NOTIFICATION_LABEL) as NotificationItem["kind"][]).map((k) => (
                    <div key={k} className="flex items-center justify-between gap-4 py-3">
                      <span className="text-sm">{NOTIFICATION_LABEL[k]}</span>
                      <Switch
                        label={NOTIFICATION_LABEL[k]}
                        checked={s.notifications[k]}
                        onCheckedChange={(v) => save({ notifications: { ...s.notifications, [k]: v } })}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="appearance">
              <Card>
                <CardHeader>
                  <CardTitle>Theme</CardTitle>
                  <CardDescription>Stored in this browser only.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                  <span className="text-sm">Dark mode</span>
                  <Switch label="Dark mode" checked={theme === "dark"} onCheckedChange={toggle} />
                </CardContent>
              </Card>
              <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="size-3.5" /> Account and sign-in details are on the <Link to="/account" className="underline">Account</Link> page.
              </p>
            </TabsContent>
          </Tabs>
        )}
      </DataState>
    </div>
  );
}

function SyncRow({
  title,
  body,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  body: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 first:pt-0">
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {title} {disabled && <span className="text-xs font-normal text-muted-foreground">(required)</span>}
        </p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <Switch label={title} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
