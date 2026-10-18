import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatNumber } from "@/lib/format";
import { METER_LABEL, METER_ORDER } from "@/lib/plans";
import type { UserDetail as Detail } from "../../client";

export interface UsageCardProps {
  user: Detail;
}

export function UsageCard({ user }: UsageCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage, {user.usagePeriod}</CardTitle>
        <CardDescription>
          {user.projects.active} active of {user.projects.total} projects. Limits include any bonus.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        {METER_ORDER.map((meter) => {
          const limit = user.subscription.limits[meter];
          return (
            <div key={meter}>
              <div className="flex justify-between text-sm">
                <span className="font-medium">{METER_LABEL[meter].label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(user.usage[meter])} / {limit == null ? "Unlimited" : formatNumber(limit)}
                </span>
              </div>
              <Progress value={limit ? user.usage[meter] / limit : 0} className="mt-2" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
