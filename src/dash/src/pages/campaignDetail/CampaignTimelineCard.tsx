import { Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataState, EmptyState } from "@/components/States";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AsyncState } from "@/hooks/useAsync";
import type { CampaignTimelineEvent } from "@/types";

const TIMELINE_DOT: Record<CampaignTimelineEvent["kind"], string> = {
  finding: "bg-severity-critical",
  status: "bg-primary",
  attempt: "bg-muted-foreground",
  info: "bg-muted-foreground",
};

export interface CampaignTimelineCardProps {
  timeline: AsyncState<CampaignTimelineEvent[]>;
}

export function CampaignTimelineCard({ timeline }: CampaignTimelineCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign timeline</CardTitle>
        <CardDescription>Status and progress events from the engine.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataState
          loading={timeline.loading}
          error={timeline.error}
          data={timeline.data}
          onRetry={timeline.refetch}
          empty={<EmptyState icon={Clock} title="No events yet" />}
        >
          {(events) => (
            <ol className="relative space-y-5 border-l pl-5">
              {events.map((event) => (
                <li key={event.id} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[25px] top-1 size-2.5 rounded-full border-2 border-background",
                      TIMELINE_DOT[event.kind],
                    )}
                  />
                  <p className="text-sm font-medium">{event.label}</p>
                  <p className="text-xs text-muted-foreground">{event.detail}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{relativeTime(event.at)}</p>
                </li>
              ))}
            </ol>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
