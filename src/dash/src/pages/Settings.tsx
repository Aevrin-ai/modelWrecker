import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataState, SkeletonCards } from "@/components/States";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import { useTheme } from "@/hooks/useTheme";
import type { WorkspaceSettings } from "@/types";
import { AppearanceTab } from "./settings/AppearanceTab";
import { NotificationsCard } from "./settings/NotificationsCard";
import { PrivacyTab } from "./settings/PrivacyTab";

export function Settings() {
  const { toast } = useToast();
  const { theme, toggle } = useTheme();
  const settings = useAsync(() => apiClient.getSettings(), []);
  // detail sync is a Pro feature; the API refuses to turn it on otherwise, this page only explains why
  const subscription = useAsync(() => apiClient.getSubscription(), []);
  const detailLocked = subscription.data ? !subscription.data.features.evidence_storage : false;
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
    } catch (err) {
      setDraft(draft);
      toast({ title: "Could not save settings", description: err instanceof Error ? err.message : undefined, tone: "error" });
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
        {(current) => (
          <Tabs defaultValue="privacy">
            <TabsList>
              <TabsTrigger value="privacy">Privacy and sync</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
            </TabsList>

            <TabsContent value="privacy" className="space-y-4">
              <PrivacyTab settings={current} detailLocked={detailLocked} onSave={save} />
            </TabsContent>

            <TabsContent value="notifications">
              <NotificationsCard settings={current} onSave={save} />
            </TabsContent>

            <TabsContent value="appearance">
              <AppearanceTab theme={theme} onToggleTheme={toggle} />
            </TabsContent>
          </Tabs>
        )}
      </DataState>
    </div>
  );
}
