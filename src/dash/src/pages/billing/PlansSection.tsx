import { DataState, SkeletonCards } from "@/components/States";
import { INTERVAL_LABEL, yearlySaving } from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { AsyncState } from "@/hooks/useAsync";
import type { BillingInterval, Plan, Subscription } from "@/types";
import { PlanCard } from "./PlanCard";

export interface PlansSectionProps {
  plans: AsyncState<Plan[]>;
  subscription: Subscription | null;
  interval: BillingInterval;
  busy: boolean;
  onIntervalChange: (interval: BillingInterval) => void;
  onBuy: (plan: Plan) => void;
}

export function PlansSection({ plans, subscription, interval, busy, onIntervalChange, onBuy }: PlansSectionProps) {
  return (
    <DataState loading={plans.loading} error={plans.error} data={plans.data} onRetry={plans.refetch} skeleton={<SkeletonCards count={3} className="lg:grid-cols-3" />}>
      {(list) => {
        const pro = list.find((candidate) => candidate.prices);
        const saving = pro ? yearlySaving(pro) : 0;
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Plans</h2>
              <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-md border p-0.5 text-sm">
                {(["month", "year"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={interval === option}
                    onClick={() => onIntervalChange(option)}
                    className={cn("rounded px-3 py-1.5 transition-colors", interval === option ? "bg-foreground text-background" : "hover:bg-accent")}
                  >
                    {INTERVAL_LABEL[option]}
                    {option === "year" && saving > 0 && <span className="ml-1 text-xs opacity-80">(save {saving}%)</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {list.map((plan) => (
                <PlanCard key={plan.id} plan={plan} sub={subscription} interval={interval} busy={busy} onBuy={() => onBuy(plan)} />
              ))}
            </div>
            {pro?.taxNote && <p className="text-xs text-muted-foreground">{pro.taxNote} Renewal is a new payment; nothing is charged automatically.</p>}
          </div>
        );
      }}
    </DataState>
  );
}
