import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsSummary } from "@/types";
import { AXIS, formatChartDate, GRID, INK, INK_2 } from "./chartTheme";
import { NoData } from "./NoData";
import { TooltipBox } from "./TooltipBox";

export interface CampaignRunsChartProps {
  data: AnalyticsSummary["campaignActivity"];
  height?: number;
}

// campaigns vs runs per day: two count series on one shared count axis, with a legend
export function CampaignRunsChart({ data, height = 240 }: CampaignRunsChartProps) {
  if (data.length === 0) return <NoData height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={formatChartDate} stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
        <Legend
          verticalAlign="top"
          align="right"
          height={28}
          iconType="circle"
          iconSize={8}
          formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.6 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox>
                <p className="mb-1 font-medium">{formatChartDate(String(label))}</p>
                {payload.map((p) => (
                  <p key={String(p.dataKey)} className="text-muted-foreground">
                    {p.name}: <span className="font-medium text-foreground">{p.value}</span>
                  </p>
                ))}
              </TooltipBox>
            ) : null
          }
        />
        <Bar dataKey="campaigns" name="Campaigns" fill={INK} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="runs" name="Runs" fill={INK_2} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
