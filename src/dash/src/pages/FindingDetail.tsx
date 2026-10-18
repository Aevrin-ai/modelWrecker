import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DataState } from "@/components/States";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { FindingBody } from "./findingDetail/FindingBody";

export function FindingDetail() {
  const { id = "" } = useParams();
  const { data, loading, error, refetch } = useAsync(() => apiClient.getFinding(id), [id]);

  return (
    <div className="space-y-6">
      <Link
        to="/findings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to findings
      </Link>

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={refetch}
        skeleton={<Skeleton className="h-96 w-full" />}
        isEmpty={(loaded) => loaded === null}
        empty={<p className="text-sm text-muted-foreground">Finding not found.</p>}
      >
        {(finding) => <FindingBody finding={finding!} />}
      </DataState>
    </div>
  );
}
