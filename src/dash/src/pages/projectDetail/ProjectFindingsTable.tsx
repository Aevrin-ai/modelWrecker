import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FindingStatusBadge, SeverityBadge } from "@/components/StatusBadges";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { relativeTime } from "@/lib/format";
import type { AsyncState } from "@/hooks/useAsync";
import type { Finding } from "@/types";

export interface ProjectFindingsTableProps {
  findings: AsyncState<Finding[]>;
}

export function ProjectFindingsTable({ findings }: ProjectFindingsTableProps) {
  return (
    <DataState loading={findings.loading} error={findings.error} data={findings.data} onRetry={findings.refetch} skeleton={<SkeletonRows rows={4} cols={4} />} empty={<EmptyState title="No findings in this project" />}>
      {(rows) => (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Finding</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Found</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((finding) => (
                <TableRow key={finding.id}>
                  <TableCell>
                    <Link to={`/findings/${finding.id}`} className="font-medium hover:underline">
                      {finding.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <SeverityBadge severity={finding.severity} />
                  </TableCell>
                  <TableCell>
                    <FindingStatusBadge status={finding.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{relativeTime(finding.discoveredAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </DataState>
  );
}
