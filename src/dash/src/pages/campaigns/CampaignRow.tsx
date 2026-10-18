import { Link } from "react-router-dom";
import { TableCell, TableRow } from "@/components/ui/table";
import { CampaignStatusBadge } from "@/components/StatusBadges";
import { formatNumber, formatPercent, relativeTime } from "@/lib/format";
import type { Campaign } from "@/types";

export interface CampaignRowProps {
  campaign: Campaign;
}

export function CampaignRow({ campaign }: CampaignRowProps) {
  return (
    <TableRow>
      <TableCell className="max-w-xs">
        <Link to={`/campaigns/${campaign.id}`} className="block">
          <span className="line-clamp-1 font-medium">{campaign.name}</span>
          <span className="text-xs text-muted-foreground">{campaign.projectName}</span>
        </Link>
      </TableCell>
      <TableCell>
        <CampaignStatusBadge status={campaign.status} />
      </TableCell>
      <TableCell className="text-sm">{campaign.targetName}</TableCell>
      <TableCell>
        <span className="line-clamp-1 font-mono text-xs">{campaign.strategies.join(", ")}</span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(campaign.attemptCount)}</TableCell>
      <TableCell className="text-right tabular-nums">{campaign.findingCount}</TableCell>
      <TableCell className="text-right tabular-nums">{formatPercent(campaign.successRate, 0)}</TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {relativeTime(campaign.completedAt ?? campaign.startedAt ?? campaign.createdAt)}
      </TableCell>
    </TableRow>
  );
}
