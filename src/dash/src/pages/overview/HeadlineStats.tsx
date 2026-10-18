import { Activity, AlertOctagon, ShieldAlert, Swords } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { DataState } from "@/components/States";
import { formatNumber, formatPercent } from "@/lib/format";
import type { AsyncState } from "@/hooks/useAsync";
import type { OverviewStats } from "@/types";
import { StatGridSkeleton } from "./StatGridSkeleton";

export interface HeadlineStatsProps {
  overview: AsyncState<OverviewStats>;
}

export function HeadlineStats({ overview }: HeadlineStatsProps) {
  return (
    <DataState
      loading={overview.loading}
      error={overview.error}
      data={overview.data}
      onRetry={overview.refetch}
      errorTitle="Unable to load overview metrics."
      skeleton={<StatGridSkeleton />}
    >
      {(stats) => (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total campaigns" value={formatNumber(stats.totalCampaigns)} icon={Swords} delta={stats.deltas.totalCampaigns} />
          <StatCard
            label="Attack success rate"
            value={formatPercent(stats.attackSuccessRate)}
            icon={Activity}
            delta={stats.deltas.attackSuccessRate}
            invertDelta
          />
          <StatCard label="Total findings" value={formatNumber(stats.totalFindings)} icon={ShieldAlert} delta={stats.deltas.totalFindings} invertDelta />
          <StatCard
            label="Critical findings"
            value={formatNumber(stats.criticalFindings)}
            icon={AlertOctagon}
            delta={stats.deltas.criticalFindings}
            invertDelta
          />
        </div>
      )}
    </DataState>
  );
}
