import { useMemo, useState } from "react";
import { Download, FileText, HardDrive, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { CommandBlock } from "@/components/CommandBlock";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useToast } from "@/hooks/useToast";
import { formatDate, humanize } from "@/lib/format";
import type { Report, ReportFormat } from "@/types";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function Reports() {
  const { activeProjectId } = useActiveProject();
  const { toast } = useToast();
  const reports = useAsync(() => apiClient.listReports({ projectId: activeProjectId ?? undefined }), [activeProjectId]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Report["kind"] | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (reports.data ?? []).filter(
      (r) =>
        (kind === "all" || r.kind === kind) &&
        (!q || r.name.toLowerCase().includes(q) || (r.campaignName ?? "").toLowerCase().includes(q)),
    );
  }, [reports.data, query, kind]);

  async function download(r: Report, format: ReportFormat) {
    try {
      const file = await apiClient.exportReport(r.id, format);
      const url = URL.createObjectURL(new Blob([file.content], { type: file.mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "This report is only on the device", description: "Open it from the local runs folder.", tone: "error" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Static reports written by the engine's analyze command: HTML, JSON, and CSV."
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reports" className="pl-9" />
          </div>
          <Select value={kind} onChange={(e) => setKind(e.target.value as Report["kind"] | "all")}>
            <option value="all">All kinds</option>
            <option value="campaign">Campaign</option>
            <option value="analytics">Analytics</option>
            <option value="leaderboard">Leaderboard</option>
          </Select>
        </div>
      </Card>

      <DataState
        loading={reports.loading}
        error={reports.error}
        data={reports.data}
        onRetry={reports.refetch}
        errorTitle="Unable to load reports."
        skeleton={<SkeletonRows rows={5} cols={5} />}
        empty={
          <EmptyState
            icon={FileText}
            title="No reports yet"
            description="Run the analyze command on a finished run. The report record syncs here."
            action={<CommandBlock command="docker compose run --rm modelwrecker analyze /work/runs/<run-id>" className="w-full max-w-lg text-left" />}
          />
        }
      >
        {() =>
          filtered.length === 0 ? (
            <EmptyState icon={Search} title="No reports match your filters" />
          ) : (
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
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <span className="block font-medium">{r.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {r.projectName} - {formatBytes(r.sizeBytes)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge>{humanize(r.kind)}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.runId}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.findingCount}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.generatedAt)}</TableCell>
                      <TableCell className="text-right">
                        {r.availability === "cloud" ? (
                          <div className="flex justify-end gap-1.5">
                            {r.formats.map((f) => (
                              <Button key={f} variant="outline" size="sm" onClick={() => download(r, f)}>
                                <Download /> {f.toUpperCase()}
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
          )
        }
      </DataState>
    </div>
  );
}
