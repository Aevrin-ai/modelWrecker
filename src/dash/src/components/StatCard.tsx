import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";

export interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: number; // signed fraction vs the previous period: 0.201 -> +20.1%
  invertDelta?: boolean; // a rising value is bad (findings, attack success rate), so colors invert
  hint?: string;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, delta, invertDelta, hint, className }: StatCardProps) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const isRising = (delta ?? 0) >= 0;
  const isGood = invertDelta ? !isRising : isRising;
  const signed = hasDelta ? `${isRising ? "+" : ""}${formatPercent(delta!, 1)}` : "";
  return (
    <Card className={cn("transition-shadow hover:shadow-card-hover", className)}>
      <div className="flex flex-row items-center justify-between p-6 pb-2">
        <p className="text-sm font-medium tracking-tight">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="p-6 pt-0">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">
          {hasDelta ? `${signed} from last period` : (hint ?? " ")}
        </p>
        {hasDelta && (
          <div className={cn("mt-2 flex items-center text-xs", isGood ? "text-success" : "text-destructive")}>
            {isRising ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
            {signed}
          </div>
        )}
      </div>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card>
      <div className="flex items-center justify-between p-6 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-4" />
      </div>
      <div className="space-y-2 p-6 pt-0">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-3 w-32" />
      </div>
    </Card>
  );
}
