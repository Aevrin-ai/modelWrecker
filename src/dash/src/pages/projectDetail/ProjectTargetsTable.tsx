import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TargetStatusBadge, TargetTypeBadge } from "@/components/StatusBadges";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { relativeTime } from "@/lib/format";
import type { AsyncState } from "@/hooks/useAsync";
import type { Target } from "@/types";

export interface ProjectTargetsTableProps {
  targets: AsyncState<Target[]>;
}

export function ProjectTargetsTable({ targets }: ProjectTargetsTableProps) {
  return (
    <DataState loading={targets.loading} error={targets.error} data={targets.data} onRetry={targets.refetch} skeleton={<SkeletonRows rows={4} cols={5} />} empty={<EmptyState title="No targets in this project" />}>
      {(rows) => (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Target</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last tested</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((target) => (
                <TableRow key={target.id}>
                  <TableCell className="font-medium">{target.name}</TableCell>
                  <TableCell>
                    <TargetTypeBadge type={target.type} />
                  </TableCell>
                  <TableCell>{target.provider}</TableCell>
                  <TableCell>
                    <TargetStatusBadge status={target.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{target.lastTestedAt ? relativeTime(target.lastTestedAt) : "Never"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </DataState>
  );
}
