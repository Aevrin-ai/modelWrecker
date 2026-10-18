import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DEVICE_STATUS_TONE, toneClass } from "@/lib/badges";
import { DEVICE_STATUS_LABEL } from "@/lib/constants";
import type { DeviceStatus } from "@/types";

export interface DeviceStatusBadgeProps {
  status: DeviceStatus;
}

export function DeviceStatusBadge({ status }: DeviceStatusBadgeProps) {
  return (
    <Badge tone={toneClass(DEVICE_STATUS_TONE[status])}>
      <span
        className={cn(
          "size-1.5 rounded-full bg-current",
          status === "online" && "animate-pulse",
        )}
      />
      {DEVICE_STATUS_LABEL[status]}
    </Badge>
  );
}
