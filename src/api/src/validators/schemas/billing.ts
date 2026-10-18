// billing request bodies (docs/billing/razorpay.md)
import { z } from "zod";

export const CheckoutReq = z
  .object({
    plan: z.literal("pro"),
    interval: z.enum(["month", "year"]),
  })
  .strict();

const razorpayId = (prefix: string) =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^${prefix}_[A-Za-z0-9]{6,40}$`), `expected a ${prefix}_ id`);

export const VerifyPaymentReq = z
  .object({
    razorpay_order_id: razorpayId("order"),
    razorpay_payment_id: razorpayId("pay"),
    razorpay_signature: z.string().trim().regex(/^[a-f0-9]{64}$/i, "expected a hex signature"),
  })
  .strict();
