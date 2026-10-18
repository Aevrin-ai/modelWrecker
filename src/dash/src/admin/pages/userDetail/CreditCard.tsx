import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { formatPaise } from "@/lib/plans";
import type { UserDetail as Detail } from "../../client";

export interface CreditCardProps {
  user: Detail;
  onAdjust: () => void;
}

export function CreditCard({ user, onAdjust }: CreditCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4" /> Account credit
        </CardTitle>
        <CardDescription>Applied automatically at the next checkout.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-semibold tabular-nums">{formatPaise(user.subscription.creditPaise)}</p>
        <ul className="max-h-32 space-y-1.5 overflow-y-auto text-xs">
          {user.creditLedger.length === 0 && <li className="text-muted-foreground">No credit changes yet.</li>}
          {user.creditLedger.map((entry) => (
            <li key={entry.id} className="flex justify-between gap-2">
              <span className="truncate text-muted-foreground" title={`${entry.reason} (${entry.actor})`}>
                {formatDate(entry.createdAt)} . {entry.reason}
              </span>
              <span className={entry.deltaPaise < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}>
                {entry.deltaPaise > 0 ? "+" : "-"}
                {formatPaise(Math.abs(entry.deltaPaise))}
              </span>
            </li>
          ))}
        </ul>
        <Button className="w-full" variant="outline" onClick={onAdjust}>
          Add or remove credit
        </Button>
      </CardContent>
    </Card>
  );
}
