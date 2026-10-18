import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FindingStatusBadge, SeverityBadge } from "@/components/StatusBadges";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { relativeTime } from "@/lib/format";
import type { AsyncState } from "@/hooks/useAsync";
import type { Finding } from "@/types";

export interface RecentFindingsCardProps {
  findings: AsyncState<Finding[]>;
}

export function RecentFindingsCard({ findings }: RecentFindingsCardProps) {
  return (
    <Card className="xl:col-span-2">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Recent findings</CardTitle>
          <CardDescription>Latest verified weaknesses.</CardDescription>
        </div>
        <Link to="/findings" className={buttonClasses("outline", "sm")}>
          View all
        </Link>
      </CardHeader>
      <CardContent>
        <DataState
          loading={findings.loading}
          error={findings.error}
          data={findings.data}
          onRetry={findings.refetch}
          errorTitle="Unable to load findings."
          skeleton={<SkeletonRows rows={5} cols={4} />}
          empty={
            <EmptyState
              icon={ShieldAlert}
              title="No findings yet"
              description="Findings appear after a campaign verifies an attack by replaying it."
            />
          }
        >
          {(list) => (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Finding</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Found</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.slice(0, 5).map((finding) => (
                      <TableRow key={finding.id}>
                        <TableCell className="max-w-[22rem]">
                          <Link to={`/findings/${finding.id}`} className="block hover:underline">
                            <span className="line-clamp-1 font-medium">{finding.title}</span>
                          </Link>
                          <span className="text-xs text-muted-foreground">{finding.targetName}</span>
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={finding.severity} />
                        </TableCell>
                        <TableCell>
                          <FindingStatusBadge status={finding.status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                          {relativeTime(finding.discoveredAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="divide-y rounded-md border md:hidden">
                {list.slice(0, 5).map((finding) => (
                  <li key={finding.id}>
                    <Link to={`/findings/${finding.id}`} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{finding.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {finding.targetName} - {relativeTime(finding.discoveredAt)}
                        </p>
                      </div>
                      <SeverityBadge severity={finding.severity} />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
