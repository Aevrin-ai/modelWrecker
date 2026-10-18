import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, humanize } from "@/lib/format";
import type { UserDetail as Detail } from "../../client";

export interface PaymentsCardProps {
  user: Detail;
  onRefund: (payment: Detail["payments"][number]) => void;
}

export function PaymentsCard({ user, onRefund }: PaymentsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments</CardTitle>
        <CardDescription>Orders and confirmed purchases. A full refund takes back the time it bought.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {user.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Credit used</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-mono text-xs">{payment.number || payment.orderId}</TableCell>
                  <TableCell>{formatDate(payment.issuedAt)}</TableCell>
                  <TableCell>
                    {humanize(payment.plan)} ({payment.interval})
                  </TableCell>
                  <TableCell>{humanize(payment.status)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(payment.amount, payment.currency)}</TableCell>
                  <TableCell className="text-right tabular-nums">{payment.creditApplied ? formatCurrency(payment.creditApplied, payment.currency) : "-"}</TableCell>
                  <TableCell className="text-right">
                    {payment.status === "paid" && payment.razorpayPaymentId && (
                      <Button variant="ghost" size="sm" onClick={() => onRefund(payment)}>
                        <RotateCcw /> Refund
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
