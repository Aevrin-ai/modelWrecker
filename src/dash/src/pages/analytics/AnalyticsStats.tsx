import { Activity, Crosshair, ShieldAlert, ShieldCheck } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { formatNumber, formatPercent } from "@/lib/format";
import type { AnalyticsSummary } from "@/types";

export interface AnalyticsStatsProps {
  summary: AnalyticsSummary;
}

export function AnalyticsStats({ summary }: AnalyticsStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Attack success rate"
        icon={Crosshair}
        value={formatPercent(summary.asr, 1)}
        hint={`95% CI ${formatPercent(summary.asrCiLow, 0)} - ${formatPercent(summary.asrCiHigh, 0)}`}
      />
      <StatCard icon={ShieldCheck} label="Robustness" value={formatPercent(summary.robustness, 1)} hint="Share of attempts the target resisted" />
      <StatCard icon={Activity} label="Attack attempts" value={formatNumber(summary.totalAttempts)} hint="Across all synced runs" />
      <StatCard icon={ShieldAlert} label="Findings" value={formatNumber(summary.totalFindings)} hint="Verified by replay" />
    </div>
  );
}
