import { Crosshair, MonitorSmartphone, Repeat, Zap } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { DataState } from "@/components/States";
import { formatNumber } from "@/lib/format";
import type { AsyncState } from "@/hooks/useAsync";
import type { OverviewStats } from "@/types";
import { StatGridSkeleton } from "./StatGridSkeleton";

export interface SecondaryStatsProps {
  overview: AsyncState<OverviewStats>;
}

export function SecondaryStats({ overview }: SecondaryStatsProps) {
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
          <StatCard label="Active targets" value={formatNumber(stats.activeTargets)} icon={Crosshair} hint="Authorized and in use" />
          <StatCard label="Connected devices" value={formatNumber(stats.connectedDevices)} icon={MonitorSmartphone} hint="Local engines online" />
          <StatCard label="Runs this period" value={formatNumber(stats.runsThisPeriod)} icon={Repeat} delta={stats.deltas.runsThisPeriod} />
          <StatCard label="Successful attacks" value={formatNumber(stats.successfulAttacks)} icon={Zap} hint="Before reliability replay" />
        </div>
      )}
    </DataState>
  );
}
