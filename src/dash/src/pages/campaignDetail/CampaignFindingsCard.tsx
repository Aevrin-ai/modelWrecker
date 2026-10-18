import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfidenceBadge, SeverityBadge } from "@/components/StatusBadges";
import { DataState, EmptyState } from "@/components/States";
import { SeverityBar } from "@/components/charts";
import { SEVERITY_ORDER } from "@/lib/constants";
import { relativeTime } from "@/lib/format";
import type { AsyncState } from "@/hooks/useAsync";
import type { Finding, Severity } from "@/types";

export interface CampaignFindingsCardProps {
  findings: AsyncState<Finding[]>;
}

export function CampaignFindingsCard({ findings }: CampaignFindingsCardProps) {
  const severity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of findings.data ?? []) severity[finding.severity] += 1;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Findings</CardTitle>
        <CardDescription>Verified by replay before they appear here.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SeverityBar breakdown={severity} />
        <DataState
          loading={findings.loading}
          error={findings.error}
          data={findings.data}
          onRetry={findings.refetch}
          empty={<EmptyState icon={ShieldAlert} title="No findings in this campaign" description="Nothing reproduced reliably enough to become a finding." />}
        >
          {(rows) => (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Finding</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Reliability</TableHead>
                    <TableHead>Found</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...rows]
                    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
                    .map((finding) => (
                      <TableRow key={finding.id}>
                        <TableCell>
                          <Link to={`/findings/${finding.id}`} className="font-medium hover:underline">
                            {finding.title}
                          </Link>
                          <span className="block font-mono text-xs text-muted-foreground">{finding.strategy}</span>
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={finding.severity} />
                        </TableCell>
                        <TableCell>
                          <ConfidenceBadge level={finding.reliability.confidence} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{relativeTime(finding.discoveredAt)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
