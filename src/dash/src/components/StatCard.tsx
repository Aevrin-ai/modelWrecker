import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Signed fraction vs previous period, e.g. 0.201 => +20.1%. */
  delta?: number;
  /** When true, a rising value is bad (e.g. findings, attack success rate) so colors invert. */
  invertDelta?: boolean;
  hint?: string;
  className?: string;
}

/**
 * Stat card measured from the reference: p-6 header with a 14px medium title and a muted
 * 16px icon, a 24px bold value, a 12px muted sub line, then a colored trend line.
 */
export function StatCard({ label, value, icon: Icon, delta, invertDelta, hint, className }: StatCardProps) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const up = (delta ?? 0) >= 0;
  const good = invertDelta ? !up : up;
  const signed = hasDelta ? `${up ? "+" : ""}${formatPercent(delta!, 1)}` : "";
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
          <div className={cn("mt-2 flex items-center text-xs", good ? "text-success" : "text-destructive")}>
            {up ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
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
