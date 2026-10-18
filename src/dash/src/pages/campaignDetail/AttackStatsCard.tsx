import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DataState, EmptyState } from "@/components/States";
import { formatPercent } from "@/lib/format";
import type { AsyncState } from "@/hooks/useAsync";
import type { CampaignStats } from "@/types";

export interface AttackStatsCardProps {
  stats: AsyncState<CampaignStats | null>;
}

export function AttackStatsCard({ stats }: AttackStatsCardProps) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Attack statistics</CardTitle>
        <CardDescription>Attempts and successes per strategy, synced from the local run.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataState
          loading={stats.loading}
          error={stats.error}
          data={stats.data}
          onRetry={stats.refetch}
          isEmpty={(campaignStats) => campaignStats.byStrategy.length === 0}
          empty={<EmptyState title="No attempts yet" description="Statistics appear after the engine starts this campaign." />}
        >
          {(campaignStats) => (
            <div className="space-y-4">
              {campaignStats.byStrategy.map((row) => {
                const rate = row.attempts ? row.successes / row.attempts : 0;
                return (
                  <div key={row.strategy}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs">{row.strategy}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {row.successes} / {row.attempts} ({formatPercent(rate, 0)})
                      </span>
                    </div>
                    <Progress value={rate} className="mt-2" />
                  </div>
                );
              })}
            </div>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
