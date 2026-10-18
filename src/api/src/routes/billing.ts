// prepaid plans through Razorpay Orders (docs/billing/razorpay.md); a payment is confirmed only server to server
import type { ApiApp, AppMiddleware } from "../types/appEnv";
import type { Deps } from "../types/deps";
import { createKeyLimit } from "../middleware/rateLimit";
import { checkout } from "../controllers/billing/checkout";
import { verifyPayment } from "../controllers/billing/verify";
import { billingWebhook } from "../controllers/billing/webhook";
import { subscription, invoices } from "../controllers/billing/subscription";

export function registerBillingRoutes(app: ApiApp, deps: Deps, requireUser: AppMiddleware): void {
  const limit = createKeyLimit(deps);
  app.get("/subscription", requireUser, (c) => subscription(c, deps));
  app.get("/invoices", requireUser, (c) => invoices(c));
  app.post("/billing/checkout", requireUser, (c) => checkout(c, deps, limit));
  app.post("/billing/verify", requireUser, (c) => verifyPayment(c, deps, limit));
  app.post("/billing/webhook", (c) => billingWebhook(c, deps, limit));
}
