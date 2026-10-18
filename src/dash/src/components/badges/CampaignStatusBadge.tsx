import { Badge } from "@/components/ui/badge";
import { CAMPAIGN_STATUS_TONE, toneClass } from "@/lib/badges";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/constants";
import type { CampaignStatus } from "@/types";

export interface CampaignStatusBadgeProps {
  status: CampaignStatus;
}

export function CampaignStatusBadge({ status }: CampaignStatusBadgeProps) {
  const isPulsing = status === "running" || status === "syncing";
  return (
    <Badge tone={toneClass(CAMPAIGN_STATUS_TONE[status])}>
      {isPulsing && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {CAMPAIGN_STATUS_LABEL[status]}
    </Badge>
  );
}
