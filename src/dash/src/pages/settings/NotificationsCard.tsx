import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/field";
import type { NotificationItem } from "@/types";
import type { WorkspaceSettings } from "@/types";

const NOTIFICATION_LABEL: Record<NotificationItem["kind"], string> = {
  campaign_completed: "A campaign completes",
  critical_finding: "A new critical finding is verified",
  device_connected: "A device connects",
  device_disconnected: "A device goes offline",
  sync_failed: "A sync fails",
  new_version: "A new engine version is available",
  subscription_changed: "Your subscription changes",
};

export interface NotificationsCardProps {
  settings: WorkspaceSettings;
  onSave: (patch: Partial<WorkspaceSettings>) => Promise<void>;
}

export function NotificationsCard({ settings, onSave }: NotificationsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notify me when</CardTitle>
        <CardDescription>In-dashboard notifications for events the control plane receives.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {(Object.keys(NOTIFICATION_LABEL) as NotificationItem["kind"][]).map((kind) => (
          <div key={kind} className="flex items-center justify-between gap-4 py-3">
            <span className="text-sm">{NOTIFICATION_LABEL[kind]}</span>
            <Switch
              label={NOTIFICATION_LABEL[kind]}
              checked={settings.notifications[kind]}
              onCheckedChange={(checked) => onSave({ notifications: { ...settings.notifications, [kind]: checked } })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
