import { humanize } from "@/lib/format";

// "user.plan_changed" -> "Plan changed"
export function actionLabel(action: string): string {
  const tail = action.split(".").pop() ?? action;
  return humanize(tail.replace(/_/g, " "));
}

// { plan: "pro", note: "" } -> "plan: pro", capped so a large detail never floods the row
export function detailSummary(detail: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(detail)) {
    if (value == null || value === "") continue;
    parts.push(`${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
  }
  return parts.join(", ").slice(0, 300);
}
