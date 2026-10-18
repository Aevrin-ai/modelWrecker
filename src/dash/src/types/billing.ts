// meters and features an entitlement can limit or switch on (docs/security/entitlements.md)
export type MeterKey = "campaigns" | "attacks" | "devices" | "projects";

export type FeatureKey =
  | "advanced_strategies"
  | "mcp"
  | "analytics"
  | "evidence_storage"
  | "enterprise";

export type BillingInterval = "month" | "year";

// an amount in the smallest unit (paise for INR)
export interface Money {
  amount: number;
  currency: string;
}

// plans are configuration (src/shared/plans.json via GET /plans), never hard-coded in a component
export interface Plan {
  id: "free" | "pro" | "enterprise";
  name: string;
  blurb: string;
  priceLabel: string; // display text, e.g. "Free", "₹899 / month", "Contact sales"
  highlighted?: boolean;
  limits: Record<MeterKey, number | null>; // null = unlimited
  features: Record<FeatureKey, boolean>;
  prices: Record<BillingInterval, Money> | null; // only for a plan that can be bought online
  taxNote: string | null;
}

export interface Subscription {
  planId: Plan["id"]; // a paid plan past its paid-until date has lapsed to "free"
  planName: string;
  status: "active" | "expired" | "canceled";
  // decided on the server only (docs/billing/razorpay.md)
  paymentStatus: "not_required" | "paid" | "pending" | "failed";
  lapsedPlanId: Plan["id"] | null;
  source: "free" | "payment" | "admin";
  interval: BillingInterval | null;
  paidUntil: string | null; // null on Free, or an open-ended grant
  renewalDue: boolean; // true within 7 days of paidUntil
  periodStart: string; // the usage period is a calendar month, UTC
  periodEnd: string;
  currency: string;
  creditPaise: number; // applied automatically at checkout
  bonus: (Record<MeterKey, number> & { expiresAt: string | null }) | null;
  limits: Record<MeterKey, number | null>; // plan limits plus any bonus, null = unlimited
  features: Record<FeatureKey, boolean>;
  usage: Record<MeterKey, number>;
  billingAvailable: boolean; // false when online payment is not available right now
}

export interface Invoice {
  id: string;
  number: string;
  amount: number; // rupees charged through the payment provider
  listPrice: number;
  creditApplied: number;
  refunded: number;
  currency: string;
  status: "paid" | "open" | "refunded" | "partially_refunded" | "void";
  plan: string;
  interval: string;
  method: string;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string;
}

// POST /billing/checkout: an order to pay in Razorpay Checkout, or paid fully by credit
export type CheckoutStart =
  | {
      paidWithCredit: false;
      orderId: string;
      amount: number;
      currency: string;
      creditApplied: number;
      keyId: string; // Razorpay's public key id, never a secret
      description: string;
      prefill: { email: string; name: string };
    }
  | { paidWithCredit: true; subscription: Subscription };

// only a hint from Razorpay Checkout: the server confirms the payment with Razorpay
export interface CheckoutSuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PaymentConfirmation {
  status: "paid" | "pending" | "failed";
  subscription: Subscription;
}
