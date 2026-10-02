import { Check, CreditCard, Minus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataState, EmptyState, SkeletonCards } from "@/components/States";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { FEATURE_LABEL, FEATURE_ORDER, METER_LABEL, METER_ORDER, PLACEHOLDER_NOTE, planById } from "@/lib/plans";
import { formatCurrency, formatDate, formatNumber, humanize } from "@/lib/format";
import { toneClass } from "@/lib/badges";
import { cn } from "@/lib/utils";

// Plans and limits come from configuration (src/lib/plans.ts), never from this
// component. This page only REPRESENTS entitlements; the cloud API and the local
// engine enforce them (docs/security/entitlements.md).

export function Billing() {
  const sub = useAsync(() => apiClient.getSubscription(), []);
  const plans = useAsync(() => apiClient.listPlans(), []);
  const invoices = useAsync(() => apiClient.listInvoices(), []);

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Your plan, usage this period, and what your plan allows. Payments are handled by Razorpay and verified on the server." />

      <DataState
        loading={sub.loading}
        error={sub.error}
        data={sub.data}
        onRetry={sub.refetch}
        errorTitle="Unable to load your subscription."
        skeleton={<SkeletonCards count={2} className="lg:grid-cols-2" />}
      >
        {(s) => {
          const plan = planById(s.planId);
          return (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardDescription>Current plan</CardDescription>
                  <CardTitle className="text-2xl">{s.planName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge tone={toneClass(s.status === "active" || s.status === "trialing" ? "emerald" : "red")}>{humanize(s.status)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment</span>
                    <span className="font-medium">{humanize(s.paymentStatus)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Billing period</span>
                    <span className="font-medium">
                      {formatDate(s.periodStart)} - {formatDate(s.periodEnd)}
                    </span>
                  </div>
                  <p className="pt-2 text-xs text-muted-foreground">{plan.blurb}</p>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Usage this period</CardTitle>
                  <CardDescription>Limits come from your plan configuration.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {METER_ORDER.map((m) => {
                    const limit = plan.limits[m];
                    const used = s.usage[m];
                    return (
                      <div key={m}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{METER_LABEL[m].label}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {formatNumber(used)} / {limit == null ? "Unlimited" : formatNumber(limit)} {METER_LABEL[m].unit}
                          </span>
                        </div>
                        <Progress value={limit ? used / limit : 0} className="mt-2" />
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground">{PLACEHOLDER_NOTE}</p>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Entitlements</CardTitle>
                  <CardDescription>
                    What your plan switches on. Hiding a button is not the control - the API and the local engine check every
                    operation against a signed entitlement.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {FEATURE_ORDER.map((f) => (
                    <div key={f} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                      {plan.features[f] ? <Check className="size-4" /> : <Minus className="size-4 text-muted-foreground" />}
                      <span className={cn(!plan.features[f] && "text-muted-foreground")}>{FEATURE_LABEL[f]}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          );
        }}
      </DataState>

      <DataState loading={plans.loading} error={plans.error} data={plans.data} onRetry={plans.refetch} skeleton={<SkeletonCards count={3} className="lg:grid-cols-3" />}>
        {(list) => (
          <div className="grid gap-4 lg:grid-cols-3">
            {list.map((p) => (
              <Card key={p.id} className={cn("flex flex-col", p.highlighted && "border-foreground")}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{p.name}</CardTitle>
                    {sub.data?.planId === p.id && <Badge>Current</Badge>}
                  </div>
                  <CardDescription>{p.blurb}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-3 text-sm">
                  <p className="text-xl font-bold">{p.priceLabel}</p>
                  {METER_ORDER.map((m) => (
                    <p key={m} className="flex justify-between">
                      <span className="text-muted-foreground">{METER_LABEL[m].label}</span>
                      <span className="tabular-nums">{p.limits[m] == null ? "Unlimited" : formatNumber(p.limits[m]!)}</span>
                    </p>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DataState>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Issued after a payment is verified by the billing webhook.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataState
            loading={invoices.loading}
            error={invoices.error}
            data={invoices.data}
            onRetry={invoices.refetch}
            empty={<EmptyState icon={CreditCard} title="No invoices" description="The free plan has no invoices." />}
          >
            {(rows) => (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-xs">{i.number}</TableCell>
                        <TableCell>{formatDate(i.issuedAt)}</TableCell>
                        <TableCell>
                          <Badge tone={toneClass(i.status === "paid" ? "emerald" : i.status === "open" ? "amber" : "slate")}>{humanize(i.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(i.amount, i.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DataState>
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" /> No payment secret is ever sent to your device, the engine, the CLI, or the MCP server.
      </p>
    </div>
  );
}
