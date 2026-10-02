/*
  Recharts wrappers, themed with the CSS design tokens so they match light and dark.
  The reference charts are monochrome: primary-ink bars with 4px rounded tops, a 2px
  primary line with dot markers, recessive dashed grid, muted 12px axis text. Severity
  is the only colored encoding and always ships with a text legend.
  Charts show synced metadata only (counts, rates, timestamps) - no raw evidence.
*/

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";
import { SEVERITY_HEX } from "@/lib/badges";
import { SEVERITY_ORDER } from "@/lib/constants";
import { formatPercent, humanize } from "@/lib/format";
import type { AnalyticsSummary, Severity } from "@/types";

const AXIS = "hsl(var(--muted-foreground))";
const GRID = "hsl(var(--border))";
const INK = "hsl(var(--chart-1))";
const INK_2 = "hsl(var(--chart-4))";
const SURFACE = "hsl(var(--card))";

function TooltipBox({ children }: { children: ReactNode }) {
  return <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-popover">{children}</div>;
}

function fmtDate(d: string): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function NoData({ height = 220, text = "No synced data to chart yet." }: { height?: number; text?: string }) {
  return (
    <div className="flex items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground" style={{ height }}>
      {text}
    </div>
  );
}

/** Severity distribution as a donut with a labelled legend (color is never alone). */
export function SeverityDonut({ breakdown, className }: { breakdown: Record<Severity, number>; className?: string }) {
  const data = SEVERITY_ORDER.map((s) => ({ name: s, value: breakdown[s] })).filter((d) => d.value > 0);
  const total = data.reduce((a, b) => a + b.value, 0);
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

/** Successful attacks per day as primary-ink bars. */
export function CampaignActivityChart({
  data,
  height = 240,
}: {
  data: AnalyticsSummary["campaignActivity"];
  height?: number;
}) {
  if (data.length === 0) return <NoData height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="18%">
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate} stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.6 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TooltipBox>
                <p className="mb-1 font-medium">{fmtDate(String(label))}</p>
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

/** Campaigns vs runs per day: two count series on one shared count axis, with a legend. */
export function CampaignRunsChart({ data, height = 240 }: { data: AnalyticsSummary["campaignActivity"]; height?: number }) {
  if (data.length === 0) return <NoData height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate} stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
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
                <p className="mb-1 font-medium">{fmtDate(String(label))}</p>
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

/** A time-series line (2px ink, dot markers) for a 0..1 rate or a count. */
export function TrendLineChart({
  data,
  asPercent = false,
  height = 240,
  valueLabel = "Value",
}: {
  data: { date: string; value: number }[];
  asPercent?: boolean;
  height?: number;
  valueLabel?: string;
}) {
  if (data.length === 0) return <NoData height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate} stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} minTickGap={16} />
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
                <p className="mb-1 font-medium">{fmtDate(String(label))}</p>
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

/** Horizontal bars for attack success rate per strategy. */
export function StrategyBars({ data }: { data: AnalyticsSummary["byStrategy"] }) {
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

/** A thin stacked severity bar for compact cards. */
export function SeverityBar({ breakdown }: { breakdown: Record<Severity, number> }) {
  const total = SEVERITY_ORDER.reduce((a, s) => a + breakdown[s], 0);
  if (total === 0) return <div className="h-2 w-full rounded-full bg-muted" />;
  return (
    <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-muted">
      {SEVERITY_ORDER.map((s) =>
        breakdown[s] > 0 ? (
          <div
            key={s}
            style={{ width: `${(breakdown[s] / total) * 100}%`, background: SEVERITY_HEX[s] }}
            title={`${breakdown[s]} ${s}`}
          />
        ) : null,
      )}
    </div>
  );
}
