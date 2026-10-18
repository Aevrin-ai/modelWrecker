import { useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { CommandBlock } from "@/components/CommandBlock";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useToast } from "@/hooks/useToast";
import type { Report, ReportFormat } from "@/types";
import { ReportsTable } from "./reports/ReportsTable";

export function Reports() {
  const { activeProjectId } = useActiveProject();
  const { toast } = useToast();
  const reports = useAsync(() => apiClient.listReports({ projectId: activeProjectId ?? undefined }), [activeProjectId]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Report["kind"] | "all">("all");

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (reports.data ?? []).filter(
      (report) =>
        (kind === "all" || report.kind === kind) &&
        (!search || report.name.toLowerCase().includes(search) || (report.campaignName ?? "").toLowerCase().includes(search)),
    );
  }, [reports.data, query, kind]);

  async function download(report: Report, format: ReportFormat) {
    try {
      const file = await apiClient.exportReport(report.id, format);
      const url = URL.createObjectURL(new Blob([file.content], { type: file.mime }));
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      link.click();
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
            <ReportsTable reports={filtered} onDownload={download} />
          )
        }
      </DataState>
    </div>
  );
}
