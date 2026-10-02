import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format";

const PLAN_TONE: Record<string, string> = {
  free: "bg-secondary text-secondary-foreground",
  pro: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  enterprise: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
};

export function PlanBadge({ plan }: { plan: string }) {
  return <Badge tone={PLAN_TONE[plan] ?? PLAN_TONE.free}>{humanize(plan)}</Badge>;
}

/** "user.plan_changed" -> "Plan changed". */
export function actionLabel(action: string): string {
  const tail = action.split(".").pop() ?? action;
  return humanize(tail.replace(/_/g, " "));
}

/** A short, readable summary of an audit entry's detail. */
export function detailSummary(detail: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(detail)) {
    if (v == null || v === "") continue;
    parts.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  }
  return parts.join(", ").slice(0, 300);
}
