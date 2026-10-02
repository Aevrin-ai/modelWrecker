import { useState } from "react";
import { Activity, CreditCard, IndianRupee, MonitorSmartphone, ShieldAlert, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { DataState, SkeletonCards } from "@/components/States";
import { TrendLineChart } from "@/components/charts";
import { useAsync } from "@/hooks/useAsync";
import { formatNumber } from "@/lib/format";
import { formatPaise } from "@/lib/plans";
import { adminClient } from "../client";

export function DaysSelect({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <Select value={String(days)} onChange={(e) => onChange(Number(e.target.value))} aria-label="Time range">
      <option value="7">Last 7 days</option>
      <option value="30">Last 30 days</option>
      <option value="90">Last 90 days</option>
      <option value="365">Last 12 months</option>
    </Select>
  );
}

export function PlatformAnalytics() {
  const [days, setDays] = useState(30);
  const data = useAsync(() => adminClient.metrics(days), [days]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="Platform analytics" description="Accounts, revenue, and synced activity across the whole platform." />
        <DaysSelect days={days} onChange={setDays} />
      </div>
      <DataState loading={data.loading} error={data.error} data={data.data} onRetry={data.refetch} skeleton={<SkeletonCards count={8} className="sm:grid-cols-2 lg:grid-cols-4" />}>
        {(m) => {
          const t = m.totals;
          const mixTotal = Math.max(1, m.planMix.free + m.planMix.pro + m.planMix.enterprise);
          return (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Users" value={formatNumber(t.users)} icon={Users} hint={`${formatNumber(t.newUsers)} new in this range`} />
                <StatCard label="Active users" value={formatNumber(t.activeUsers)} icon={Activity} hint="Synced a run or a device was seen" />
                <StatCard label="Paying accounts" value={formatNumber(t.paying)} icon={CreditCard} hint={`${formatNumber(t.granted)} more granted by Aevrin`} />
                <StatCard label="Monthly recurring revenue" value={formatPaise(t.mrrPaise)} icon={IndianRupee} hint="Paid plans in effect, per month, GST included" />
                <StatCard label="Revenue in range" value={formatPaise(t.revenuePaise)} icon={IndianRupee} hint={t.refundedPaise ? `${formatPaise(t.refundedPaise)} refunded` : "No refunds"} />
                <StatCard label="New users" value={formatNumber(t.newUsers)} icon={UserPlus} />
                <StatCard label="Connected devices" value={formatNumber(t.devices)} icon={MonitorSmartphone} hint={`${formatNumber(t.campaigns)} campaigns in total`} />
                <StatCard label="Runs synced" value={formatNumber(t.runs)} icon={ShieldAlert} hint={`${formatNumber(t.findings)} findings`} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Sign-ups</CardTitle>
                    <CardDescription>New accounts per day.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TrendLineChart data={m.daily.map((d) => ({ date: d.date, value: d.signups }))} valueLabel="Sign-ups" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue</CardTitle>
                    <CardDescription>Confirmed payments per day, rupees, after refunds.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TrendLineChart data={m.daily.map((d) => ({ date: d.date, value: d.revenuePaise / 100 }))} valueLabel="Rupees" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Runs synced</CardTitle>
                    <CardDescription>Campaign runs reaching the dashboard per day.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TrendLineChart data={m.daily.map((d) => ({ date: d.date, value: d.runs }))} valueLabel="Runs" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Plan mix</CardTitle>
                    <CardDescription>Accounts by the plan in effect now.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(["free", "pro", "enterprise"] as const).map((p) => (
                      <div key={p}>
                        <div className="flex justify-between text-sm">
                          <span className="font-medium capitalize">{p}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {formatNumber(m.planMix[p])} ({Math.round((m.planMix[p] / mixTotal) * 100)}%)
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-foreground" style={{ width: `${(m.planMix[p] / mixTotal) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                    {t.suspended > 0 && <p className="text-xs text-muted-foreground">{formatNumber(t.suspended)} suspended account(s).</p>}
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        }}
      </DataState>
    </div>
  );
}
