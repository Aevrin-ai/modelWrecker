import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatNumber } from "@/lib/format";
import { METER_LABEL, METER_ORDER } from "@/lib/plans";
import type { UserDetail as Detail } from "../../client";
import { DetailRow } from "./DetailRow";

export interface BonusCardProps {
  user: Detail;
  onSet: () => void;
}

export function BonusCard({ user, onSet }: BonusCardProps) {
  const bonus = user.subscription.bonus;
  const hasBonus = METER_ORDER.some((meter) => bonus[meter] > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="size-4" /> Bonus
        </CardTitle>
        <CardDescription>Extra allowance on top of the plan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {!hasBonus && <p className="text-sm text-muted-foreground">No bonus.</p>}
        {hasBonus &&
          METER_ORDER.filter((meter) => bonus[meter] > 0).map((meter) => (
            <DetailRow key={meter} label={METER_LABEL[meter].label}>
              +{formatNumber(bonus[meter])}
            </DetailRow>
          ))}
        {hasBonus && <DetailRow label="Until">{bonus.expires_at ? formatDate(bonus.expires_at) : "No end date"}</DetailRow>}
        <Button className="mt-2 w-full" variant="outline" onClick={onSet}>
          {hasBonus ? "Change bonus" : "Give a bonus"}
        </Button>
      </CardContent>
    </Card>
  );
}
