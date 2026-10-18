import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format";

const PLAN_TONE: Record<string, string> = {
  free: "bg-secondary text-secondary-foreground",
  pro: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  enterprise: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
};

export interface PlanBadgeProps {
  plan: string;
}

export function PlanBadge({ plan }: PlanBadgeProps) {
  return <Badge tone={PLAN_TONE[plan] ?? PLAN_TONE.free}>{humanize(plan)}</Badge>;
}
