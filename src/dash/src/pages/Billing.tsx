import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataState, SkeletonCards } from "@/components/States";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import { openCheckout } from "@/lib/razorpay";
import { formatDate } from "@/lib/format";
import type { BillingInterval, Plan } from "@/types";
import { InvoicesCard } from "./billing/InvoicesCard";
import { PlansSection } from "./billing/PlansSection";
import { SubscriptionCards } from "./billing/SubscriptionCards";

// this page only shows entitlements: the API and the local engine enforce them, and the server decides payment
export function Billing() {
  const subscription = useAsync(() => apiClient.getSubscription(), []);
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
      subscription.refetch();
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
        loading={subscription.loading}
        error={subscription.error}
        data={subscription.data}
        onRetry={subscription.refetch}
        errorTitle="Unable to load your subscription."
        skeleton={<SkeletonCards count={2} className="lg:grid-cols-2" />}
      >
        {(current) => <SubscriptionCards subscription={current} />}
      </DataState>

      <PlansSection
        plans={plans}
        subscription={subscription.data}
        interval={interval}
        busy={busy}
        onIntervalChange={setBillingInterval}
        onBuy={buy}
      />

      <InvoicesCard invoices={invoices} />

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" /> Card and UPI details are entered in Razorpay's form and never reach Aevrin. No payment secret is ever sent
        to your device, the engine, the CLI, or the MCP server.
      </p>
    </div>
  );
}
