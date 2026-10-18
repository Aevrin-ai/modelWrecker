import { Badge } from "@/components/ui/badge";
import { FINDING_STATUS_TONE, toneClass } from "@/lib/badges";
import { FINDING_STATUS_LABEL } from "@/lib/constants";
import type { FindingStatus } from "@/types";

export interface FindingStatusBadgeProps {
  status: FindingStatus;
}

export function FindingStatusBadge({ status }: FindingStatusBadgeProps) {
  return <Badge tone={toneClass(FINDING_STATUS_TONE[status])}>{FINDING_STATUS_LABEL[status]}</Badge>;
}
