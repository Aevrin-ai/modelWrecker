import { Badge } from "@/components/ui/badge";
import { TARGET_STATUS_TONE, toneClass } from "@/lib/badges";
import { TARGET_STATUS_LABEL } from "@/lib/constants";
import type { TargetStatus } from "@/types";

export interface TargetStatusBadgeProps {
  status: TargetStatus;
}

export function TargetStatusBadge({ status }: TargetStatusBadgeProps) {
  return <Badge tone={toneClass(TARGET_STATUS_TONE[status])}>{TARGET_STATUS_LABEL[status]}</Badge>;
}
