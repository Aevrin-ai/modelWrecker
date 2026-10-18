import { Cpu, MoreHorizontal, Pencil, ShieldOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { DeviceStatusBadge } from "@/components/StatusBadges";
import { formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Device } from "@/types";
import { DeviceFact } from "./DeviceFact";

export interface DeviceCardProps {
  device: Device;
  onRename: (device: Device) => void;
  onRevoke: (device: Device) => void;
}

export function DeviceCard({ device, onRename, onRevoke }: DeviceCardProps) {
  return (
    <Card className="flex flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md border bg-muted/40">
            <Cpu className="size-5" />
          </span>
          <div>
            <p className="font-semibold leading-tight">{device.name}</p>
            <p className="text-xs text-muted-foreground">{device.os}</p>
          </div>
        </div>
        <Dropdown
          align="end"
          label={`Actions for ${device.name}`}
          trigger={
            <span className={buttonClasses("ghost", "icon")}>
              <MoreHorizontal />
            </span>
          }
        >
          {(close) => (
            <>
              <DropdownItem
                onClick={() => {
                  close();
                  onRename(device);
                }}
              >
                <Pencil className="size-4" /> Rename
              </DropdownItem>
              <DropdownItem
                onClick={() => {
                  close();
                  onRevoke(device);
                }}
                className="text-destructive"
              >
                <ShieldOff className="size-4" /> Revoke access
              </DropdownItem>
            </>
          )}
        </Dropdown>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <DeviceStatusBadge status={device.status} />
        <span className={cn("text-xs", device.engineHealthy ? "text-muted-foreground" : "text-destructive")}>
          {device.engineHealthy ? "Engine healthy" : "Engine reported a problem"}
        </span>
      </div>

      <dl className="mt-5 space-y-2 text-sm">
        <DeviceFact label="ModelWrecker" value={`v${device.engineVersion}`} />
        <DeviceFact label="Last seen" value={relativeTime(device.lastSeenAt)} />
        <DeviceFact label="Last sync" value={device.lastSyncAt ? relativeTime(device.lastSyncAt) : "Never"} />
        <DeviceFact label="Project" value={device.projectName ?? "Unassigned"} />
        <DeviceFact label="Fingerprint" value={device.fingerprint} mono />
      </dl>

      {device.status === "offline" && (
        <p className="mt-5 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Offline since {formatDateTime(device.lastSeenAt)}. Campaign results will sync when the engine reconnects.
        </p>
      )}
    </Card>
  );
}
