import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { SEVERITY_HEX } from "@/lib/badges";
import { SEVERITY_ORDER } from "@/lib/constants";
import type { Severity } from "@/types";
import { SURFACE } from "./chartTheme";
import { NoData } from "./NoData";
import { TooltipBox } from "./TooltipBox";

export interface SeverityDonutProps {
  breakdown: Record<Severity, number>;
  className?: string;
}

// severity distribution as a donut with a labelled legend (color is never alone)
export function SeverityDonut({ breakdown, className }: SeverityDonutProps) {
  const data = SEVERITY_ORDER.map((severity) => ({ name: severity, value: breakdown[severity] })).filter((slice) => slice.value > 0);
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  if (total === 0) return <NoData text="No findings to chart yet." />;
  return (
    <div className={className}>
      <div className="relative">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={88}
              paddingAngle={0}
              stroke={SURFACE}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={SEVERITY_HEX[d.name as Severity]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox>
                    <span className="font-medium capitalize">{payload[0].name}</span>: {payload[0].value} findings
                  </TooltipBox>
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums">{total}</span>
          <span className="text-xs text-muted-foreground">findings</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs">
            <span className="size-2 rounded-full" style={{ background: SEVERITY_HEX[d.name as Severity] }} />
            <span className="capitalize text-muted-foreground">{d.name}</span>
            <span className="ml-auto font-medium tabular-nums">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
