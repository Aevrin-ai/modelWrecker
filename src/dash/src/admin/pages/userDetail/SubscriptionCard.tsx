import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, humanize } from "@/lib/format";
import type { UserDetail as Detail } from "../../client";
import { PlanBadge } from "../PlanBadge";
import { DetailRow } from "./DetailRow";

export interface SubscriptionCardProps {
  user: Detail;
  onChange: () => void;
}

function paidUntilLabel(subscription: Detail["subscription"]): string {
  if (subscription.effectivePlan === "free") return "-";
  if (subscription.paidUntil) return formatDate(subscription.paidUntil);
  return "No end date";
}

export function SubscriptionCard({ user, onChange }: SubscriptionCardProps) {
  const subscription = user.subscription;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan</CardTitle>
        <CardDescription>What this account can use right now.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <DetailRow label="In effect">
          <PlanBadge plan={subscription.effectivePlan} />
        </DetailRow>
        {subscription.lapsed && <DetailRow label="Lapsed from">{humanize(subscription.storedPlan)}</DetailRow>}
        <DetailRow label="Paid until">{paidUntilLabel(subscription)}</DetailRow>
        <DetailRow label="Source">{humanize(subscription.source)}</DetailRow>
        {subscription.interval && <DetailRow label="Billing">{humanize(subscription.interval)}ly, prepaid</DetailRow>}
        <Button className="mt-2 w-full" variant="outline" onClick={onChange}>
          Change plan
        </Button>
      </CardContent>
    </Card>
  );
}
