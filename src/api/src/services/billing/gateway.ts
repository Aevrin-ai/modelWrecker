import type { Deps } from "../../types/deps";
import { ApiError } from "../../lib/errors";
import { log } from "../../lib/log";
import { RazorpayError, type BillingConfig } from "../razorpay/client";

export function requireBilling(deps: Deps): BillingConfig {
  if (!deps.billing) throw new ApiError(503, "billing_unavailable", "Payments are not available right now. Try again later.");
  return deps.billing;
}

/** A Razorpay failure becomes a safe 502 with the provider's status in the logs; anything else is rethrown. */
export function gatewayError(err: unknown): never {
  if (err instanceof RazorpayError) {
    log.error("payment_provider_failed", { providerStatus: err.status, providerCode: err.code });
    throw new ApiError(502, "payment_provider_error", "The payment provider did not respond as expected. Try again shortly.");
  }
  throw err;
}
