import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { ConfidenceBadge, FindingStatusBadge, SeverityBadge, TargetTypeBadge } from "@/components/StatusBadges";
import { formatPercent, relativeTime } from "@/lib/format";
import type { Finding } from "@/types";

export interface FindingRowProps {
  finding: Finding;
}

export function FindingRow({ finding }: FindingRowProps) {
  return (
    <TableRow className="cursor-pointer">
      <TableCell className="max-w-xs">
        <Link to={`/findings/${finding.id}`} className="block">
          <span className="line-clamp-1 font-medium">{finding.title}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {finding.evidence.synced ? "Evidence synced" : (
              <>
                <Lock className="size-3" /> Evidence stays local
              </>
            )}
          </span>
        </Link>
      </TableCell>
      <TableCell>
        <SeverityBadge severity={finding.severity} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <TargetTypeBadge type={finding.targetType} />
          <span className="truncate text-sm">{finding.targetName}</span>
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs">{finding.strategy}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <ConfidenceBadge level={finding.reliability.confidence} />
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatPercent(finding.reliability.successRate, 0)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <FindingStatusBadge status={finding.status} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {relativeTime(finding.discoveredAt)}
      </TableCell>
    </TableRow>
  );
}
