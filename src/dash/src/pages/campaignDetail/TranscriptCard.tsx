import { ListOrdered } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataState } from "@/components/States";
import { EvidenceLocalNotice } from "@/components/LocalBoundary";
import { RunTranscripts } from "@/components/RunTranscripts";
import type { AsyncState } from "@/hooks/useAsync";
import type { CampaignTranscript } from "@/types";

export interface TranscriptCardProps {
  transcript: AsyncState<CampaignTranscript | null>;
}

export function TranscriptCard({ transcript }: TranscriptCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListOrdered className="size-4 text-brand" />
          Attack transcript
        </CardTitle>
        <CardDescription>
          Every attempt the engine made: the prompt sent, the model reply, and the result. Open an attempt to read it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataState
          loading={transcript.loading}
          error={transcript.error}
          data={transcript.data}
          onRetry={transcript.refetch}
          isEmpty={() => false}
          empty={<EvidenceLocalNotice kind="transcript" />}
        >
          {(campaignTranscript) => <RunTranscripts runs={campaignTranscript.runs} />}
        </DataState>
      </CardContent>
    </Card>
  );
}
