import { useMemo, useState } from "react";
import { Search, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useActiveProject } from "@/hooks/useActiveProject";
import { humanize } from "@/lib/format";
import { SEVERITY_ORDER } from "@/lib/constants";
import type { FindingStatus, Severity } from "@/types";
import { FindingCardList } from "./findings/FindingCardList";
import { FindingsTable } from "./findings/FindingsTable";

const STATUSES: FindingStatus[] = ["open", "triaged", "fixed", "accepted-risk"];

export function Findings() {
  const { activeProjectId } = useActiveProject();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [status, setStatus] = useState<FindingStatus | "all">("all");

  const { data, loading, error, refetch } = useAsync(
    () => apiClient.listFindings({ projectId: activeProjectId ?? undefined }),
    [activeProjectId],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    const search = query.trim().toLowerCase();
    return data.filter(
      (finding) =>
        (severity === "all" || finding.severity === severity) &&
        (status === "all" || finding.status === status) &&
        (!search ||
          finding.title.toLowerCase().includes(search) ||
          finding.targetName.toLowerCase().includes(search) ||
          finding.strategy.toLowerCase().includes(search)),
    );
  }, [data, query, severity, status]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Findings"
        description="Verified weaknesses. Each has a measured success rate, not a one-shot result."
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, target, or strategy"
              className="pl-9"
            />
          </div>
          <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity | "all")}>
            <option value="all">All severities</option>
            {SEVERITY_ORDER.map((option) => (
              <option key={option} value={option} className="capitalize">
                {humanize(option)}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as FindingStatus | "all")}>
            <option value="all">All statuses</option>
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {humanize(option)}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={refetch}
        skeleton={<SkeletonRows rows={6} cols={6} />}
        empty={
          <EmptyState
            icon={ShieldAlert}
            title="No findings yet"
            description="Findings appear here after a campaign verifies an attack on a target."
          />
        }
      >
        {() =>
          filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No findings match your filters"
              description="Try clearing the search or changing the severity and status filters."
            />
          ) : (
            <>
              <FindingsTable findings={filtered} />

              <FindingCardList findings={filtered} />
            </>
          )
        }
      </DataState>
    </div>
  );
}
