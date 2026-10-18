import { ShieldCheck, ShieldX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SeverityBadge, TargetStatusBadge, TargetTypeBadge } from "@/components/StatusBadges";
import { relativeTime } from "@/lib/format";
import type { Target } from "@/types";

export interface TargetsTableProps {
  targets: Target[];
}

export function TargetsTable({ targets }: TargetsTableProps) {
  return (
      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Target</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Authorized</TableHead>
              <TableHead>Campaigns</TableHead>
              <TableHead>Top severity</TableHead>
              <TableHead>Last tested</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.map((target) => (
              <TableRow key={target.id}>
                <TableCell>
                  <p className="font-medium">{target.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{target.endpoint}</p>
                </TableCell>
                <TableCell>
                  <TargetTypeBadge type={target.type} />
                </TableCell>
                <TableCell>
                  <p className="text-sm">{target.model}</p>
                  <p className="text-xs text-muted-foreground">{target.provider}</p>
                </TableCell>
                <TableCell>
                  <TargetStatusBadge status={target.status} />
                </TableCell>
                <TableCell>
                  {target.authorized ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="size-3.5" /> Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <ShieldX className="size-3.5" /> No
                    </span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{target.campaignCount}</TableCell>
                <TableCell>
                  {target.topSeverity ? <SeverityBadge severity={target.topSeverity} /> : <span className="text-xs text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {relativeTime(target.lastTestedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
  );
}
