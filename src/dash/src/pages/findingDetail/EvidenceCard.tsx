import { Terminal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EvidenceLocalNotice } from "@/components/LocalBoundary";
import type { Finding } from "@/types";
import { EvidenceView } from "./EvidenceView";

export interface EvidenceCardProps {
  finding: Finding;
}

// detailed evidence stays on the device unless the account syncs it
export function EvidenceCard({ finding }: EvidenceCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="size-4 text-brand" />
          Evidence
        </CardTitle>
        <CardDescription>The exact prompt sent and the model reply, when synced.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {finding.evidence.synced ? (
          <EvidenceView finding={finding} />
        ) : (
          <EvidenceLocalNotice />
        )}
      </CardContent>
    </Card>
  );
}
