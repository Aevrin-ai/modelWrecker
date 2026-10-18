import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CampaignStatusBadge } from "@/components/StatusBadges";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { formatPercent } from "@/lib/format";
import type { AsyncState } from "@/hooks/useAsync";
import type { Campaign } from "@/types";

export interface ProjectCampaignsTableProps {
  campaigns: AsyncState<Campaign[]>;
}

export function ProjectCampaignsTable({ campaigns }: ProjectCampaignsTableProps) {
  return (
    <DataState loading={campaigns.loading} error={campaigns.error} data={campaigns.data} onRetry={campaigns.refetch} skeleton={<SkeletonRows rows={4} cols={5} />} empty={<EmptyState title="No campaigns in this project" />}>
      {(rows) => (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Target</TableHead>
                <TableHead className="text-right">Findings</TableHead>
                <TableHead className="text-right">ASR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <Link to={`/campaigns/${campaign.id}`} className="font-medium hover:underline">
                      {campaign.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <CampaignStatusBadge status={campaign.status} />
                  </TableCell>
                  <TableCell>{campaign.targetName}</TableCell>
                  <TableCell className="text-right tabular-nums">{campaign.findingCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(campaign.successRate, 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </DataState>
  );
}
