// Razorpay Checkout, loaded only on Buy; its result is a hint the server verifies (docs/billing/razorpay.md)

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
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loading = null;
        script.remove();
        reject(new Error("The payment form could not be loaded. Check your connection or ad blocker and try again."));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

type CheckoutOutcome =
  | { kind: "success"; result: CheckoutSuccess }
  | { kind: "dismissed" }
  | { kind: "failed"; message: string };

// card and UPI details stay in Razorpay's frame; resolves when the user finishes, fails, or closes it
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
    // a failed attempt keeps Checkout open for a retry; it is reported only if the user then closes it
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
