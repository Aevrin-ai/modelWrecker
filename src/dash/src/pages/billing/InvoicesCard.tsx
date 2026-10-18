import { CreditCard, Printer } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataState, EmptyState } from "@/components/States";
import { INTERVAL_LABEL } from "@/lib/plans";
import { formatCurrency, formatDate, humanize } from "@/lib/format";
import { toneClass, type Tone } from "@/lib/badges";
import type { BillingInterval, Invoice } from "@/types";
import type { AsyncState } from "@/hooks/useAsync";
import { printReceipt } from "./printReceipt";

const INVOICE_STATUS_TONE: Partial<Record<Invoice["status"], Tone>> = { paid: "emerald", open: "amber" };

export interface InvoicesCardProps {
  invoices: AsyncState<Invoice[]>;
}

export function InvoicesCard({ invoices }: InvoicesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
        <CardDescription>Issued after the server confirms a payment with Razorpay.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataState
          loading={invoices.loading}
          error={invoices.error}
          data={invoices.data}
          onRetry={invoices.refetch}
          empty={<EmptyState icon={CreditCard} title="No invoices" description="Purchases appear here once they are confirmed." />}
        >
          {(rows) => (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Covers</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-10"><span className="sr-only">Receipt</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-xs">{invoice.number}</TableCell>
                      <TableCell>{formatDate(invoice.issuedAt)}</TableCell>
                      <TableCell>
                        {humanize(invoice.plan)} <span className="text-muted-foreground">({INTERVAL_LABEL[invoice.interval as BillingInterval] ?? invoice.interval})</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
                      </TableCell>
                      <TableCell>
                        <Badge tone={toneClass(INVOICE_STATUS_TONE[invoice.status] ?? "slate")}>{humanize(invoice.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(invoice.amount, invoice.currency)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" title="Print receipt" aria-label={`Print receipt ${invoice.number}`} onClick={() => printReceipt(invoice)}>
                          <Printer />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
