import { INTERVAL_LABEL } from "@/lib/plans";
import { formatCurrency, formatDate, humanize } from "@/lib/format";
import type { BillingInterval, Invoice } from "@/types";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

// a plain printable receipt in a new window; every value is escaped
export function printReceipt(invoice: Invoice) {
  const receiptWindow = window.open("", "_blank", "noopener=no,width=720,height=860");
  if (!receiptWindow) return;
  const money = (amount: number) => escapeHtml(formatCurrency(amount, invoice.currency));
  const row = (label: string, value: string) => `<tr><th>${escapeHtml(label)}</th><td>${value}</td></tr>`;
  receiptWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${escapeHtml(invoice.number)}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;color:#111;margin:40px}h1{font-size:20px;margin:0 0 4px}
table{border-collapse:collapse;width:100%;margin-top:24px}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd}
th{width:40%;color:#555;font-weight:500}.muted{color:#666;font-size:12px;margin-top:24px}</style></head><body>
<h1>Aevrin - payment receipt</h1><div class="muted">vyra.aevrin.ai</div>
<table>
${row("Receipt number", escapeHtml(invoice.number))}
${row("Date", escapeHtml(formatDate(invoice.issuedAt)))}
${row("Plan", `${escapeHtml(humanize(invoice.plan))}, ${escapeHtml(INTERVAL_LABEL[invoice.interval as BillingInterval] ?? invoice.interval)} (prepaid)`)}
${row("Covers", `${escapeHtml(formatDate(invoice.periodStart))} - ${escapeHtml(formatDate(invoice.periodEnd))}`)}
${row("List price", money(invoice.listPrice))}
${invoice.creditApplied ? row("Account credit applied", `-${money(invoice.creditApplied)}`) : ""}
${row("Amount paid", money(invoice.amount))}
${invoice.refunded ? row("Refunded", money(invoice.refunded)) : ""}
${row("Payment method", escapeHtml(humanize(invoice.method || "razorpay")))}
${row("Status", escapeHtml(humanize(invoice.status)))}
</table>
<p class="muted">Prices include 18% GST. Payment processed by Razorpay.</p>
<script>window.onload=function(){window.print()}</script></body></html>`);
  receiptWindow.document.close();
}
