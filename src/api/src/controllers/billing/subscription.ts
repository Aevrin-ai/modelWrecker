import type { AppContext } from "../../types/appEnv";
import { reconcileOwner } from "../../services/billing/reconcile";
import { invoiceView, subscriptionView } from "../../services/billing/views";
import type { Deps } from "../../types/deps";

// reconciles recent unpaid orders first, in case the tab closed and a webhook was missed
export async function subscription(c: AppContext, deps: Deps): Promise<Response> {
  const owner = c.get("user").id;
  await reconcileOwner(deps, owner);
  return c.json(await subscriptionView(deps, c.get("db"), owner));
}

export async function invoices(c: AppContext): Promise<Response> {
  const rows = await c.get("db").table("payments").select({
    eq: { owner_id: c.get("user").id },
    in: { column: "status", values: ["paid", "refunded", "partially_refunded"] },
    order: { column: "paid_at", ascending: false },
    limit: 100,
  });
  return c.json(rows.map(invoiceView));
}
