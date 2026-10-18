import { Download, HardDrive } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, humanize } from "@/lib/format";
import type { Report } from "@/types";
import type { ReportFormat } from "@/types";

// 1536 -> "1.5 KB"
function formatBytes(byteCount: number): string {
  if (byteCount < 1024) return `${byteCount} B`;
  if (byteCount < 1024 * 1024) return `${(byteCount / 1024).toFixed(1)} KB`;
  return `${(byteCount / 1024 / 1024).toFixed(1)} MB`;
}

export interface ReportsTableProps {
  reports: Report[];
  onDownload: (report: Report, format: ReportFormat) => void;
}

export function ReportsTable({ reports, onDownload }: ReportsTableProps) {
  return (
    <Card className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Report</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Run</TableHead>
            <TableHead className="text-right">Findings</TableHead>
            <TableHead>Generated</TableHead>
            <TableHead className="text-right">Download</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => (
            <TableRow key={report.id}>
              <TableCell>
                <span className="block font-medium">{report.name}</span>
                <span className="text-xs text-muted-foreground">
                  {report.projectName} - {formatBytes(report.sizeBytes)}
                </span>
              </TableCell>
              <TableCell>
                <Badge>{humanize(report.kind)}</Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{report.runId}</TableCell>
              <TableCell className="text-right tabular-nums">{report.findingCount}</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(report.generatedAt)}</TableCell>
              <TableCell className="text-right">
                {report.availability === "cloud" ? (
                  <div className="flex justify-end gap-1.5">
                    {report.formats.map((format) => (
                      <Button key={format} variant="outline" size="sm" onClick={() => onDownload(report, format)}>
                        <Download /> {format.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <HardDrive className="size-3.5" /> On device only
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
