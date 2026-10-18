import { ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { relativeTime } from "@/lib/format";
import type { UserDetail as Detail } from "../../client";

export interface DevicesCardProps {
  user: Detail;
  onRevoke: (device: Detail["devices"][number]) => void;
}

export function DevicesCard({ user, onRevoke }: DevicesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Devices</CardTitle>
        <CardDescription>Engines signed in to this account. Revoking stops sync at once.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {user.devices.length === 0 && <p className="text-sm text-muted-foreground">No devices.</p>}
        {user.devices.map((device) => (
          <div key={device.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {device.name} {device.revoked && <Badge>Revoked</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">
                {device.os} . engine {device.engineVersion || "?"} . seen {device.lastSeenAt ? relativeTime(device.lastSeenAt) : "never"}
              </p>
            </div>
            {!device.revoked && (
              <Button variant="ghost" size="sm" onClick={() => onRevoke(device)}>
                <ShieldOff /> Revoke
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
