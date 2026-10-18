import type { AppContext } from "../../types/appEnv";
import { reconcileOwner } from "../../services/billing/reconcile";
import { invoiceView, subscriptionView } from "../../services/billing/views";
import type { Deps } from "../../types/deps";
import { paymentsRepository } from "../../repositories/payments";

// reconciles recent unpaid orders first, in case the tab closed and a webhook was missed
export async function subscription(c: AppContext, deps: Deps): Promise<Response> {
  const owner = c.get("user").id;
  await reconcileOwner(deps, owner);
  return c.json(await subscriptionView(deps, c.get("db"), owner));
}

export async function invoices(c: AppContext): Promise<Response> {
  const rows = await paymentsRepository(c.get("db")).listInvoicesForOwner(c.get("user").id, 100);
  return c.json(rows.map(invoiceView));
}
