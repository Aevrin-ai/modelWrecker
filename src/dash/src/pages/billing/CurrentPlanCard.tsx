import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INTERVAL_LABEL, formatPaise, planById } from "@/lib/plans";
import { formatDate, humanize } from "@/lib/format";
import { toneClass } from "@/lib/badges";
import type { Subscription } from "@/types";
import { BillingRow } from "./BillingRow";

export interface CurrentPlanCardProps {
  subscription: Subscription;
}

export function CurrentPlanCard({ subscription }: CurrentPlanCardProps) {
  const plan = planById(subscription.planId);

  return (
    <Card>
      <CardHeader>
        <CardDescription>Current plan</CardDescription>
        <CardTitle className="text-2xl">{subscription.planName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <BillingRow label="Status">
          <Badge tone={toneClass(subscription.status === "active" ? "emerald" : "red")}>{humanize(subscription.status)}</Badge>
        </BillingRow>
        {subscription.paymentStatus === "pending" && (
          <BillingRow label="Payment">
            <span className="font-medium">Confirming</span>
          </BillingRow>
        )}
        {subscription.planId !== "free" && (
          <BillingRow label="Paid until">
            <span className="font-medium">{subscription.paidUntil ? formatDate(subscription.paidUntil) : "No end date"}</span>
          </BillingRow>
        )}
        {subscription.interval && (
          <BillingRow label="Billing">
            <span className="font-medium">{INTERVAL_LABEL[subscription.interval]}, prepaid</span>
          </BillingRow>
        )}
        {subscription.source === "admin" && subscription.planId !== "free" && (
          <BillingRow label="Granted by">
            <span className="font-medium">Aevrin</span>
          </BillingRow>
        )}
        {subscription.creditPaise > 0 && (
          <BillingRow label="Account credit">
            <span className="font-medium">{formatPaise(subscription.creditPaise, subscription.currency)}</span>
          </BillingRow>
        )}
        <p className="pt-2 text-xs text-muted-foreground">{plan.blurb}</p>
      </CardContent>
    </Card>
  );
}
