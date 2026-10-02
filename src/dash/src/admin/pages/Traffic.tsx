import { useState } from "react";
import type { ReactNode } from "react";
import { Eye, Globe, MousePointerClick, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataState, SkeletonCards } from "@/components/States";
import { TrendLineChart } from "@/components/charts";
import { useAsync } from "@/hooks/useAsync";
import { formatNumber, humanize } from "@/lib/format";
import { adminClient } from "../client";
import { DaysSelect } from "./PlatformAnalytics";

const regionName = (() => {
  try {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    return (code: string) => (code === "??" ? "Unknown" : (names.of(code) ?? code));
  } catch {
    return (code: string) => code;
  }
})();

function Breakdown({ title, description, rows }: { title: string; description: string; rows: { label: ReactNode; value: number; sub?: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No views yet.</p>}
        {rows.map((r, i) => (
          <div key={i} className="relative overflow-hidden rounded-md px-2 py-1.5 text-sm">
            <div className="absolute inset-y-0 left-0 rounded-md bg-muted" style={{ width: `${(r.value / max) * 100}%` }} />
            <div className="relative flex justify-between gap-3">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">{formatNumber(r.value)}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function Traffic() {
  const [days, setDays] = useState(30);
  const [site, setSite] = useState("");
  const data = useAsync(() => adminClient.traffic(days, site), [days, site]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Page analytics"
          description="First-party and cookie-free. Visitors are counted per day from a salted hash; no IP address is stored, and browsers with Do Not Track or Global Privacy Control are not counted."
        />
        <div className="flex gap-2">
          <Select value={site} onChange={(e) => setSite(e.target.value)} aria-label="Site">
            <option value="">Landing and dashboard</option>
            <option value="landing">Landing page</option>
            <option value="dashboard">Dashboard</option>
          </Select>
          <DaysSelect days={days} onChange={setDays} />
        </div>
      </div>
      <DataState loading={data.loading} error={data.error} data={data.data} onRetry={data.refetch} skeleton={<SkeletonCards count={4} className="sm:grid-cols-2 lg:grid-cols-4" />}>
        {(t) => (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Page views" value={formatNumber(t.views)} icon={Eye} />
              <StatCard label="Visitors" value={formatNumber(t.visitors)} icon={Users} hint="Unique per day, summed" />
              <StatCard label="Views per visitor" value={t.visitors ? (t.views / t.visitors).toFixed(1) : "0"} icon={MousePointerClick} />
              <StatCard label="Countries" value={formatNumber(t.countries.length)} icon={Globe} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Page views</CardTitle>
                  <CardDescription>Per day.</CardDescription>
                </CardHeader>
                <CardContent>
                  <TrendLineChart data={t.daily.map((d) => ({ date: d.date, value: d.views }))} valueLabel="Views" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Visitors</CardTitle>
                  <CardDescription>Unique visitors per day.</CardDescription>
                </CardHeader>
                <CardContent>
                  <TrendLineChart data={t.daily.map((d) => ({ date: d.date, value: d.visitors }))} valueLabel="Visitors" />
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Top pages</CardTitle>
                <CardDescription>Ids in paths are replaced with :id; query strings are never stored.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Page</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Visitors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {t.pages.map((p) => (
                      <TableRow key={`${p.site}${p.path}`}>
                        <TableCell className="font-mono text-xs">{p.path}</TableCell>
                        <TableCell>{humanize(p.site)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(p.views)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(p.visitors)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {t.pages.length === 0 && <p className="pt-2 text-sm text-muted-foreground">No views in this range yet.</p>}
              </CardContent>
            </Card>
            <div className="grid gap-4 lg:grid-cols-3">
              <Breakdown title="Referrers" description="Where visitors came from (host only)." rows={t.referrers.map((r) => ({ label: r.referrer, value: r.views }))} />
              <Breakdown title="Countries" description="From the network edge, not stored per person." rows={t.countries.map((c) => ({ label: regionName(c.country), value: c.views }))} />
              <Breakdown title="Devices" description="Desktop, mobile, or tablet." rows={t.devices.map((d) => ({ label: humanize(d.device), value: d.views }))} />
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
