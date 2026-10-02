/*
  Razorpay Checkout in the browser (docs/billing/razorpay.md).

  The script is Razorpay's hosted payment form. It is loaded only when the user clicks Buy, never on
  page load. Card and UPI details are typed into Razorpay's frame and never reach Aevrin.

  What Checkout returns on success is only a hint. The page sends it to POST /billing/verify, where the
  server checks the signature with its secret key and asks Razorpay itself before the plan changes.
*/

import type { CheckoutSuccess } from "@/types";

const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill?: { email?: string; name?: string };
  theme?: { color?: string };
  handler: (result: CheckoutSuccess) => void;
  modal?: { ondismiss?: () => void; confirm_close?: boolean };
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (resp: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_URL;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loading = null;
        s.remove();
        reject(new Error("The payment form could not be loaded. Check your connection or ad blocker and try again."));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export type CheckoutOutcome =
  | { kind: "success"; result: CheckoutSuccess }
  | { kind: "dismissed" }
  | { kind: "failed"; message: string };

/** Open Razorpay Checkout for one order and resolve when the user finishes, fails, or closes it. */
export async function openCheckout(order: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  prefill: { email: string; name: string };
}): Promise<CheckoutOutcome> {
  await loadScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("The payment form could not be loaded. Try again.");
  return new Promise<CheckoutOutcome>((resolve) => {
    // A failed attempt keeps Checkout open so the user can retry; it is reported only if they then close.
    let lastFailure = "";
    const rzp = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "Aevrin",
      description: order.description,
      prefill: order.prefill,
      theme: { color: "#18181b" },
      handler: (result) => resolve({ kind: "success", result }),
      modal: {
        ondismiss: () => resolve(lastFailure ? { kind: "failed", message: lastFailure } : { kind: "dismissed" }),
        confirm_close: true,
      },
    });
    rzp.on("payment.failed", (resp) => {
      lastFailure = resp.error?.description ?? "The payment did not go through.";
    });
    rzp.open();
  });
}
