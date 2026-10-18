import { Crosshair, Swords } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TargetTypeBadge } from "@/components/StatusBadges";
import { formatDateTime } from "@/lib/format";
import type { Finding } from "@/types";
import { MetaLink } from "./MetaLink";
import { MetaRow } from "./MetaRow";

export interface ContextCardProps {
  finding: Finding;
}

export function ContextCard({ finding }: ContextCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <MetaLink icon={Crosshair} label="Target" to="/targets">
          <span className="flex items-center gap-2">
            <TargetTypeBadge type={finding.targetType} />
            {finding.targetName}
          </span>
        </MetaLink>
        <MetaLink icon={Swords} label="Campaign" to={`/campaigns/${finding.campaignId}`}>
          {finding.campaignName}
        </MetaLink>
        <MetaRow label="Strategy">
          <span className="font-mono text-xs">{finding.strategy}</span>
        </MetaRow>
        <MetaRow label="Model">{finding.model}</MetaRow>
        <MetaRow label="Provider">{finding.provider}</MetaRow>
        <MetaRow label="Discovered">{formatDateTime(finding.discoveredAt)}</MetaRow>
        <MetaRow label="Last seen">{formatDateTime(finding.lastSeenAt)}</MetaRow>
      </CardContent>
    </Card>
  );
}
