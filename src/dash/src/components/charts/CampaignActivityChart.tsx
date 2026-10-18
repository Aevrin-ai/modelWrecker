import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsSummary } from "@/types";
import { AXIS, formatChartDate, GRID, INK } from "./chartTheme";
import { NoData } from "./NoData";
import { TooltipBox } from "./TooltipBox";

export interface CampaignActivityChartProps {
  data: AnalyticsSummary["campaignActivity"];
  height?: number;
}

// successful attacks per day as primary-ink bars
export function CampaignActivityChart({ data, height = 240 }: CampaignActivityChartProps) {
  if (data.length === 0) return <NoData height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="18%">
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={formatChartDate} stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.6 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox>
                <p className="mb-1 font-medium">{formatChartDate(String(label))}</p>
                <p className="text-muted-foreground">
                  Successful attacks: <span className="font-medium text-foreground">{payload[0].value}</span>
                </p>
              </TooltipBox>
            ) : null
          }
        />
        <Bar dataKey="successfulAttacks" fill={INK} radius={[4, 4, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}
