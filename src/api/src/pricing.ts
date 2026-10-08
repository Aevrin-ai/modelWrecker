// The cost model behind the prices in src/shared/plans.json (issue #42). Not used at request time: a test
// (test/billing.test.ts) checks that every paid price keeps a margin inside MARGIN_BAND, so a price or cost
// change that breaks the rule fails CI. Change the inputs here when real costs change, then re-check prices.
// Full explanation: docs/billing/pricing.md.
import config from "../../shared/plans.json";

/** The margin band every paid price must stay inside: profit as a share of revenue after GST. */
export const MARGIN_BAND = { min: 0.3, max: 0.4 } as const;

/** Monthly cost to serve one paying account, in rupees. */
const COST_MODEL = {
  /** Fixed platform cost per month: managed Postgres ($25), Workers paid plan ($5), domain, mail, monitoring. */
  platformFixedPerMonth: 3000,
  /** How many paying accounts the fixed cost is spread over (a conservative first-year planning base). */
  plannedPayingAccounts: 25,
  /** Evidence and transcript storage plus egress, per account per month. */
  storagePerAccount: 40,
  /** Support and operations time, per account per month (about 15 minutes at 1,200 per hour). */
  supportPerAccount: 300,
  /** Prices include GST; it is passed on to the government, not revenue. */
  gstRate: 0.18,
  /** Razorpay standard domestic fee (2%) plus 18% GST on that fee, as a share of the gross price. */
  paymentFeeRate: 0.02 * 1.18,
} as const;

/** Cost to serve one paying account for one month, in rupees. */
function monthlyCostPerAccount(model = COST_MODEL): number {
  return model.platformFixedPerMonth / model.plannedPayingAccounts + model.storagePerAccount + model.supportPerAccount;
}

/**
 * Margin of a price that covers `months` months: (net revenue - payment fee - cost) / net revenue,
 * where net revenue is the price without GST.
 */
function margin(pricePaise: number, months: number, model = COST_MODEL): number {
  const grossPerMonth = pricePaise / 100 / months;
  const net = grossPerMonth / (1 + model.gstRate);
  const fee = grossPerMonth * model.paymentFeeRate;
  return (net - fee - monthlyCostPerAccount(model)) / net;
}

/** Every paid price in the shared config with its margin. */
export function priceTable(): { plan: string; interval: "month" | "year"; pricePaise: number; margin: number }[] {
  const out: { plan: string; interval: "month" | "year"; pricePaise: number; margin: number }[] = [];
  for (const p of config.plans) {
    if (!p.prices) continue;
    out.push({ plan: p.id, interval: "month", pricePaise: p.prices.month, margin: margin(p.prices.month, 1) });
    out.push({ plan: p.id, interval: "year", pricePaise: p.prices.year, margin: margin(p.prices.year, 12) });
  }
  return out;
}
