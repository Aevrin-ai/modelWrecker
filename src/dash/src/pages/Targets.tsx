import { useMemo, useState } from "react";
import { Crosshair, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { TargetDialog } from "@/components/dialogs";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useActiveProject } from "@/hooks/useActiveProject";
import { TARGET_TYPES, TARGET_TYPE_LABEL } from "@/lib/constants";
import type { TargetType } from "@/types";
import { TargetCardList } from "./targets/TargetCardList";
import { TargetsTable } from "./targets/TargetsTable";

export function Targets() {
  const { activeProjectId } = useActiveProject();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TargetType | "all">("all");
  const [creating, setCreating] = useState(false);

  const { data, loading, error, refetch } = useAsync(
    () => apiClient.listTargets({ projectId: activeProjectId ?? undefined }),
    [activeProjectId],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    const search = query.trim().toLowerCase();
    return data.filter(
      (target) =>
        (type === "all" || target.type === type) &&
        (!search ||
          target.name.toLowerCase().includes(search) ||
          target.provider.toLowerCase().includes(search) ||
          target.model.toLowerCase().includes(search)),
    );
  }, [data, query, type]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Targets"
        description="The AI systems under test. A target must be authorized before any campaign can run against it."
        actions={
          <Button variant="brand" size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Add target
          </Button>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, provider, or model"
              className="pl-9"
            />
          </div>
          <Select value={type} onChange={(e) => setType(e.target.value as TargetType | "all")}>
            <option value="all">All types</option>
            {TARGET_TYPES.map((targetType) => (
              <option key={targetType} value={targetType}>
                {TARGET_TYPE_LABEL[targetType]}
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
            icon={Crosshair}
            title="No targets yet"
            description="Add a chat, agent, RAG, or MCP target to start red-teaming it."
            action={
              <Button variant="brand" size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" />
                Add target
              </Button>
            }
          />
        }
      >
        {() =>
          filtered.length === 0 ? (
            <EmptyState icon={Search} title="No targets match your filters" />
          ) : (
            <>
              <TargetsTable targets={filtered} />

              <TargetCardList targets={filtered} />
            </>
          )
        }
      </DataState>

      <TargetDialog open={creating} onClose={() => setCreating(false)} onSaved={() => refetch()} />
    </div>
  );
}
