import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CloudLocalDiagram } from "@/components/LocalBoundary";
import type { AsyncState } from "@/hooks/useAsync";
import type { WorkspaceSettings } from "@/types";

export interface DataLocationCardProps {
  settings: AsyncState<WorkspaceSettings>;
}

export function DataLocationCard({ settings }: DataLocationCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Where your data lives</CardTitle>
        <CardDescription>The dashboard is the control plane. Attacks run on your machine.</CardDescription>
      </CardHeader>
      <CardContent>
        <CloudLocalDiagram
          className="md:grid-cols-1"
          evidenceSynced={!!settings.data && (settings.data.sync.detailedEvidence || settings.data.sync.transcripts)}
        />
      </CardContent>
    </Card>
  );
}
