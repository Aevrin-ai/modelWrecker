import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPercent, humanize } from "@/lib/format";
import type { AnalyticsSummary } from "@/types";
import { AXIS, GRID, INK } from "./chartTheme";
import { NoData } from "./NoData";
import { TooltipBox } from "./TooltipBox";

export interface StrategyBarsProps {
  data: AnalyticsSummary["byStrategy"];
}

// horizontal bars for attack success rate per strategy
export function StrategyBars({ data }: StrategyBarsProps) {
  if (data.length === 0) return <NoData />;
  const rows = [...data].sort((a, b) => b.asr - a.asr);
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 34)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis
          type="number"
          stroke={AXIS}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${Math.round(v * 100)}%`}
        />
        <YAxis
          type="category"
          dataKey="strategy"
          stroke={AXIS}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={132}
          tickFormatter={humanize}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.6 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox>
                <p className="mb-1 font-medium">{humanize(String(payload[0].payload.strategy))}</p>
                <p className="text-muted-foreground">
                  ASR {formatPercent(Number(payload[0].payload.asr))} over {payload[0].payload.attempts} attempts
                </p>
              </TooltipBox>
            ) : null
          }
        />
        <Bar dataKey="asr" fill={INK} radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
