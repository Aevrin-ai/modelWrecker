import { Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { FEATURE_LABEL, FEATURE_ORDER, METER_LABEL, METER_ORDER, formatPaise } from "@/lib/plans";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BillingInterval, Plan, Subscription } from "@/types";
import type { ReactNode } from "react";

const CONTACT_URL = "https://aevrin.net";

function buyLabel(plan: Plan, isCurrent: boolean, interval: BillingInterval): string {
  if (!isCurrent) return `Upgrade to ${plan.name}`;
  return interval === "year" ? "Add a year" : "Add a month";
}

export interface PlanCardProps {
  plan: Plan;
  sub: Subscription | null;
  interval: BillingInterval;
  busy: boolean;
  onBuy: () => void;
}

export function PlanCard({ plan, sub, interval, busy, onBuy }: PlanCardProps) {
  const current = sub?.planId === plan.id;
  const price = plan.prices?.[interval];
  const perMonth = price && interval === "year" ? price.amount / 12 : null;
  let action: ReactNode = null;
  if (plan.prices) {
    const label = buyLabel(plan, current, interval);
    const blocked = !sub?.billingAvailable || sub?.planId === "enterprise";
    action = (
      <Button className="w-full" onClick={onBuy} disabled={busy || blocked}>
        {busy && <Loader2 className="animate-spin" />}
        {label}
      </Button>
    );
  } else if (plan.id === "enterprise") {
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
          <CardTitle>{plan.name}</CardTitle>
          {current && <Badge>Current</Badge>}
        </div>
        <CardDescription>{plan.blurb}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 text-sm">
        <div>
          <p className="text-2xl font-bold">
            {price ? formatPaise(price.amount, price.currency) : plan.priceLabel}
            {price && <span className="text-sm font-normal text-muted-foreground"> / {interval === "year" ? "year" : "month"}</span>}
          </p>
          {perMonth && <p className="text-xs text-muted-foreground">{formatPaise(perMonth, price!.currency)} a month, billed yearly</p>}
        </div>
        <div className="space-y-1.5">
          {METER_ORDER.map((meter) => (
            <p key={meter} className="flex justify-between">
              <span className="text-muted-foreground">{METER_LABEL[meter].label}</span>
              <span className="tabular-nums">{plan.limits[meter] == null ? "Unlimited" : formatNumber(plan.limits[meter]!)}</span>
            </p>
          ))}
        </div>
        <ul className="space-y-1.5">
          {FEATURE_ORDER.filter((feature) => plan.features[feature]).map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <Check className="size-3.5" /> {FEATURE_LABEL[feature]}
            </li>
          ))}
        </ul>
        {action && <div className="mt-auto pt-2">{action}</div>}
        {plan.prices && sub && sub.creditPaise > 0 && !current && (
          <p className="text-xs text-muted-foreground">Your {formatPaise(sub.creditPaise, sub.currency)} credit is applied at checkout.</p>
        )}
      </CardContent>
    </Card>
  );
}
