import { Gift } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { METER_LABEL, METER_ORDER } from "@/lib/plans";
import { formatDate, formatNumber } from "@/lib/format";
import type { Subscription } from "@/types";

export interface UsageThisMonthCardProps {
  subscription: Subscription;
}

export function UsageThisMonthCard({ subscription }: UsageThisMonthCardProps) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Usage this month</CardTitle>
        <CardDescription>
          {formatDate(subscription.periodStart)} - {formatDate(subscription.periodEnd)}. Runs and attempts reset on the 1st (UTC).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {METER_ORDER.map((meter) => {
          const limit = subscription.limits[meter];
          const used = subscription.usage[meter];
          return (
            <div key={meter}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{METER_LABEL[meter].label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(used)} / {limit == null ? "Unlimited" : formatNumber(limit)} {METER_LABEL[meter].unit}
                </span>
              </div>
              <Progress value={limit ? used / limit : 0} className="mt-2" />
            </div>
          );
        })}
        {subscription.bonus && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Gift className="size-3.5" /> Includes a bonus from Aevrin
            {subscription.bonus.expiresAt ? ` until ${formatDate(subscription.bonus.expiresAt)}` : ""}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
