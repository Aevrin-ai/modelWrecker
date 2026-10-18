import { planById } from "@/lib/plans";
import { formatDate } from "@/lib/format";
import type { Subscription } from "@/types";
import { BillingBanner } from "./BillingBanner";
import { CurrentPlanCard } from "./CurrentPlanCard";
import { EntitlementsCard } from "./EntitlementsCard";
import { UsageThisMonthCard } from "./UsageThisMonthCard";

export interface SubscriptionCardsProps {
  subscription: Subscription;
}

export function SubscriptionCards({ subscription }: SubscriptionCardsProps) {
  const plan = planById(subscription.planId);
  const lapsed = subscription.status !== "active" && subscription.lapsedPlanId;
  return (
    <div className="space-y-4">
      {lapsed && (
        <BillingBanner tone="red">
          Your {planById(subscription.lapsedPlanId!).name} plan {subscription.status === "canceled" ? "was canceled" : "ended"}. You are on Free until you buy again; your
          synced data is kept.
        </BillingBanner>
      )}
      {!lapsed && subscription.renewalDue && subscription.paidUntil && (
        <BillingBanner tone="amber">
          Your {plan.name} plan is paid until {formatDate(subscription.paidUntil)}. Renew below to keep it; a renewal adds time to the current end date.
        </BillingBanner>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <CurrentPlanCard subscription={subscription} />
        <UsageThisMonthCard subscription={subscription} />
        <EntitlementsCard subscription={subscription} />
      </div>
    </div>
  );
}
