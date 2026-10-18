import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPercent } from "@/lib/format";
import { AXIS, formatChartDate, GRID, INK, SURFACE } from "./chartTheme";
import { NoData } from "./NoData";
import { TooltipBox } from "./TooltipBox";

export interface TrendLineChartProps {
  data: { date: string; value: number }[];
  asPercent?: boolean;
  height?: number;
  valueLabel?: string;
}

// a time-series line (2px ink, dot markers) for a 0..1 rate or a count
export function TrendLineChart({ data, asPercent = false, height = 240, valueLabel = "Value" }: TrendLineChartProps) {
  if (data.length === 0) return <NoData height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={formatChartDate} stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis
          stroke={AXIS}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={44}
          allowDecimals={asPercent}
          tickFormatter={(v) => (asPercent ? `${Math.round(v * 100)}%` : String(v))}
        />
        <Tooltip
          cursor={{ stroke: GRID, strokeWidth: 1 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox>
                <p className="mb-1 font-medium">{formatChartDate(String(label))}</p>
                <p className="text-muted-foreground">
                  {valueLabel}:{" "}
                  <span className="font-medium text-foreground">
                    {asPercent ? formatPercent(Number(payload[0].value)) : `${payload[0].value}`}
                  </span>
                </p>
              </TooltipBox>
            ) : null
          }
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={INK}
          strokeWidth={2}
          dot={{ r: 3, fill: INK, stroke: SURFACE, strokeWidth: 1 }}
          activeDot={{ r: 5, fill: INK, stroke: SURFACE, strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
