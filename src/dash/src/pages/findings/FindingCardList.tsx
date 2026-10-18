import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ConfidenceBadge, FindingStatusBadge, SeverityBadge } from "@/components/StatusBadges";
import { humanize } from "@/lib/format";
import type { Finding } from "@/types";

export interface FindingCardListProps {
  findings: Finding[];
}

export function FindingCardList({ findings }: FindingCardListProps) {
  return (
      <div className="space-y-3 md:hidden">
        {findings.map((finding) => (
          <Link key={finding.id} to={`/findings/${finding.id}`}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{finding.title}</p>
                <SeverityBadge severity={finding.severity} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {finding.targetName} - {humanize(finding.strategy)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <FindingStatusBadge status={finding.status} />
                <ConfidenceBadge level={finding.reliability.confidence} />
                {!finding.evidence.synced && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="size-3" /> Evidence local
                  </span>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>
  );
}
