import { Check, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FEATURE_LABEL, FEATURE_ORDER } from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { Subscription } from "@/types";

export interface EntitlementsCardProps {
  subscription: Subscription;
}

export function EntitlementsCard({ subscription }: EntitlementsCardProps) {
  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>Entitlements</CardTitle>
        <CardDescription>
          What your plan switches on. Hiding a button is not the control - the API and the local engine check every operation against a signed
          entitlement. Run <code className="font-mono">modelwrecker plan --refresh</code> after a change.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {FEATURE_ORDER.map((feature) => (
          <div key={feature} className="flex items-center gap-2 rounded-md border p-3 text-sm">
            {subscription.features[feature] ? <Check className="size-4" /> : <Minus className="size-4 text-muted-foreground" />}
            <span className={cn(!subscription.features[feature] && "text-muted-foreground")}>{FEATURE_LABEL[feature]}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
