import { useState } from "react";
import { AlertTriangle, Check, CreditCard, Gift, Loader2, Minus, Printer, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataState, EmptyState, SkeletonCards } from "@/components/States";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import {
  FEATURE_LABEL,
  FEATURE_ORDER,
  INTERVAL_LABEL,
  METER_LABEL,
  METER_ORDER,
  formatPaise,
  planById,
  yearlySaving,
} from "@/lib/plans";
import { openCheckout } from "@/lib/razorpay";
import { formatCurrency, formatDate, formatNumber, humanize } from "@/lib/format";
import { toneClass } from "@/lib/badges";
import { cn } from "@/lib/utils";
import type { BillingInterval, Invoice, Plan, Subscription } from "@/types";

// Plans, limits, and prices come from configuration (src/shared/plans.json via GET /plans), never from
// this component. This page only REPRESENTS entitlements; the cloud API and the local engine enforce
// them (docs/security/entitlements.md). Payment success is decided on the server (docs/billing/razorpay.md).

const CONTACT_URL = "https://aevrin.net";

export function Billing() {
  const sub = useAsync(() => apiClient.getSubscription(), []);
  const plans = useAsync(() => apiClient.listPlans(), []);
  const invoices = useAsync(() => apiClient.listInvoices(), []);
  const { toast } = useToast();
  const [interval, setBillingInterval] = useState<BillingInterval>("month");
  const [busy, setBusy] = useState(false);

  async function buy(plan: Plan) {
    if (!plan.prices || busy) return;
    setBusy(true);
    try {
      const start = await apiClient.startCheckout("pro", interval);
      if (start.paidWithCredit) {
        toast({ title: `${plan.name} is active`, description: "Paid in full from your account credit." });
      } else {
        const outcome = await openCheckout(start);
        if (outcome.kind === "dismissed") return;
        if (outcome.kind === "failed") {
          toast({ title: "Payment failed", description: outcome.message, tone: "error" });
          return;
        }
        const confirmed = await apiClient.confirmPayment(outcome.result);
        if (confirmed.status === "paid") {
          toast({ title: `${plan.name} is active`, description: `Paid until ${formatDate(confirmed.subscription.paidUntil)}.` });
        } else {
          toast({
            title: "Payment received, confirming",
            description: "Razorpay has not confirmed it yet. This page updates within a few minutes; you will not be charged twice.",
          });
        }
      }
      sub.refetch();
      invoices.refetch();
    } catch (err) {
      toast({ title: "Could not complete the purchase", description: err instanceof Error ? err.message : "Try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Your plan, this month's usage, and what your plan allows. Plans are prepaid by the month or the year through Razorpay, and every payment is confirmed on the server."
      />

      <DataState
        loading={sub.loading}
        error={sub.error}
        data={sub.data}
        onRetry={sub.refetch}
        errorTitle="Unable to load your subscription."
        skeleton={<SkeletonCards count={2} className="lg:grid-cols-2" />}
      >
        {(s) => <SubscriptionCards s={s} />}
      </DataState>

      <DataState loading={plans.loading} error={plans.error} data={plans.data} onRetry={plans.refetch} skeleton={<SkeletonCards count={3} className="lg:grid-cols-3" />}>
        {(list) => {
          const pro = list.find((p) => p.prices);
          const saving = pro ? yearlySaving(pro) : 0;
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Plans</h2>
                <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-md border p-0.5 text-sm">
                  {(["month", "year"] as const).map((i) => (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={interval === i}
                      onClick={() => setBillingInterval(i)}
                      className={cn("rounded px-3 py-1.5 transition-colors", interval === i ? "bg-foreground text-background" : "hover:bg-accent")}
                    >
                      {INTERVAL_LABEL[i]}
                      {i === "year" && saving > 0 && <span className="ml-1 text-xs opacity-80">(save {saving}%)</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {list.map((p) => (
                  <PlanCard key={p.id} plan={p} sub={sub.data} interval={interval} busy={busy} onBuy={() => buy(p)} />
                ))}
              </div>
              {pro?.taxNote && <p className="text-xs text-muted-foreground">{pro.taxNote} Renewal is a new payment; nothing is charged automatically.</p>}
            </div>
          );
        }}
      </DataState>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Issued after the server confirms a payment with Razorpay.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataState
            loading={invoices.loading}
            error={invoices.error}
            data={invoices.data}
            onRetry={invoices.refetch}
            empty={<EmptyState icon={CreditCard} title="No invoices" description="Purchases appear here once they are confirmed." />}
          >
            {(rows) => (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Covers</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-10"><span className="sr-only">Receipt</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-mono text-xs">{i.number}</TableCell>
                        <TableCell>{formatDate(i.issuedAt)}</TableCell>
                        <TableCell>
                          {humanize(i.plan)} <span className="text-muted-foreground">({INTERVAL_LABEL[i.interval as BillingInterval] ?? i.interval})</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(i.periodStart)} - {formatDate(i.periodEnd)}
                        </TableCell>
                        <TableCell>
                          <Badge tone={toneClass(i.status === "paid" ? "emerald" : i.status === "open" ? "amber" : "slate")}>{humanize(i.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(i.amount, i.currency)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" title="Print receipt" aria-label={`Print receipt ${i.number}`} onClick={() => printReceipt(i)}>
                            <Printer />
                          </Button>
                        </TableCell>
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
        <ShieldCheck className="size-3.5" /> Card and UPI details are entered in Razorpay's form and never reach Aevrin. No payment secret is ever sent
        to your device, the engine, the CLI, or the MCP server.
      </p>
    </div>
  );
}

function SubscriptionCards({ s }: { s: Subscription }) {
  const plan = planById(s.planId);
  const lapsed = s.status !== "active" && s.lapsedPlanId;
  return (
    <div className="space-y-4">
      {lapsed && (
        <Banner tone="red">
          Your {planById(s.lapsedPlanId!).name} plan {s.status === "canceled" ? "was canceled" : "ended"}. You are on Free until you buy again; your
          synced data is kept.
        </Banner>
      )}
      {!lapsed && s.renewalDue && s.paidUntil && (
        <Banner tone="amber">
          Your {plan.name} plan is paid until {formatDate(s.paidUntil)}. Renew below to keep it; a renewal adds time to the current end date.
        </Banner>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Current plan</CardDescription>
            <CardTitle className="text-2xl">{s.planName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Status">
              <Badge tone={toneClass(s.status === "active" ? "emerald" : "red")}>{humanize(s.status)}</Badge>
            </Row>
            {s.paymentStatus === "pending" && (
              <Row label="Payment">
                <span className="font-medium">Confirming</span>
              </Row>
            )}
            {s.planId !== "free" && (
              <Row label="Paid until">
                <span className="font-medium">{s.paidUntil ? formatDate(s.paidUntil) : "No end date"}</span>
              </Row>
            )}
            {s.interval && (
              <Row label="Billing">
                <span className="font-medium">{INTERVAL_LABEL[s.interval]}, prepaid</span>
              </Row>
            )}
            {s.source === "admin" && s.planId !== "free" && (
              <Row label="Granted by">
                <span className="font-medium">Aevrin</span>
              </Row>
            )}
            {s.creditPaise > 0 && (
              <Row label="Account credit">
                <span className="font-medium">{formatPaise(s.creditPaise, s.currency)}</span>
              </Row>
            )}
            <p className="pt-2 text-xs text-muted-foreground">{plan.blurb}</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Usage this month</CardTitle>
            <CardDescription>
              {formatDate(s.periodStart)} - {formatDate(s.periodEnd)}. Runs and attempts reset on the 1st (UTC).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {METER_ORDER.map((m) => {
              const limit = s.limits[m];
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
            {s.bonus && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Gift className="size-3.5" /> Includes a bonus from Aevrin
                {s.bonus.expiresAt ? ` until ${formatDate(s.bonus.expiresAt)}` : ""}.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Entitlements</CardTitle>
            <CardDescription>
              What your plan switches on. Hiding a button is not the control - the API and the local engine check every operation against a signed
              entitlement. Run <code className="font-mono">modelwrecker plan --refresh</code> after a change.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {FEATURE_ORDER.map((f) => (
              <div key={f} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                {s.features[f] ? <Check className="size-4" /> : <Minus className="size-4 text-muted-foreground" />}
                <span className={cn(!s.features[f] && "text-muted-foreground")}>{FEATURE_LABEL[f]}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PlanCard({
  plan: p,
  sub,
  interval,
  busy,
  onBuy,
}: {
  plan: Plan;
  sub: Subscription | null;
  interval: BillingInterval;
  busy: boolean;
  onBuy: () => void;
}) {
  const current = sub?.planId === p.id;
  const price = p.prices?.[interval];
  const perMonth = price && interval === "year" ? price.amount / 12 : null;
  let action: React.ReactNode = null;
  if (p.prices) {
    const label = current ? (interval === "year" ? "Add a year" : "Add a month") : `Upgrade to ${p.name}`;
    const blocked = !sub?.billingAvailable || sub?.planId === "enterprise";
    action = (
      <Button className="w-full" onClick={onBuy} disabled={busy || blocked}>
        {busy && <Loader2 className="animate-spin" />}
        {label}
      </Button>
    );
  } else if (p.id === "enterprise") {
    action = (
      <a className={buttonClasses("outline", "default", "w-full")} href={CONTACT_URL} target="_blank" rel="noreferrer">
        Contact us
      </a>
    );
  }
  return (
    <Card className={cn("flex flex-col", current && "border-foreground")}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{p.name}</CardTitle>
          {current && <Badge>Current</Badge>}
        </div>
        <CardDescription>{p.blurb}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 text-sm">
        <div>
          <p className="text-2xl font-bold">
            {price ? formatPaise(price.amount, price.currency) : p.priceLabel}
            {price && <span className="text-sm font-normal text-muted-foreground"> / {interval === "year" ? "year" : "month"}</span>}
          </p>
          {perMonth && <p className="text-xs text-muted-foreground">{formatPaise(perMonth, price!.currency)} a month, billed yearly</p>}
        </div>
        <div className="space-y-1.5">
          {METER_ORDER.map((m) => (
            <p key={m} className="flex justify-between">
              <span className="text-muted-foreground">{METER_LABEL[m].label}</span>
              <span className="tabular-nums">{p.limits[m] == null ? "Unlimited" : formatNumber(p.limits[m]!)}</span>
            </p>
          ))}
        </div>
        <ul className="space-y-1.5">
          {FEATURE_ORDER.filter((f) => p.features[f]).map((f) => (
            <li key={f} className="flex items-center gap-2">
              <Check className="size-3.5" /> {FEATURE_LABEL[f]}
            </li>
          ))}
        </ul>
        {action && <div className="mt-auto pt-2">{action}</div>}
        {p.prices && sub && sub.creditPaise > 0 && !current && (
          <p className="text-xs text-muted-foreground">Your {formatPaise(sub.creditPaise, sub.currency)} credit is applied at checkout.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Banner({ tone, children }: { tone: "amber" | "red"; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border p-3 text-sm",
        tone === "amber" ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100" : "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Open a plain printable receipt in a new window. Every value is escaped. */
function printReceipt(i: Invoice) {
  const w = window.open("", "_blank", "noopener=no,width=720,height=860");
  if (!w) return;
  const money = (n: number) => esc(formatCurrency(n, i.currency));
  const row = (k: string, v: string) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(i.number)}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;color:#111;margin:40px}h1{font-size:20px;margin:0 0 4px}
table{border-collapse:collapse;width:100%;margin-top:24px}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd}
th{width:40%;color:#555;font-weight:500}.muted{color:#666;font-size:12px;margin-top:24px}</style></head><body>
<h1>Aevrin - payment receipt</h1><div class="muted">app.aevrin.net</div>
<table>
${row("Receipt number", esc(i.number))}
${row("Date", esc(formatDate(i.issuedAt)))}
${row("Plan", `${esc(humanize(i.plan))}, ${esc(INTERVAL_LABEL[i.interval as BillingInterval] ?? i.interval)} (prepaid)`)}
${row("Covers", `${esc(formatDate(i.periodStart))} - ${esc(formatDate(i.periodEnd))}`)}
${row("List price", money(i.listPrice))}
${i.creditApplied ? row("Account credit applied", `-${money(i.creditApplied)}`) : ""}
${row("Amount paid", money(i.amount))}
${i.refunded ? row("Refunded", money(i.refunded)) : ""}
${row("Payment method", esc(humanize(i.method || "razorpay")))}
${row("Status", esc(humanize(i.status)))}
</table>
<p class="muted">Prices include 18% GST. Payment processed by Razorpay.</p>
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}
