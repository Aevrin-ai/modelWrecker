import { useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { useAsync } from "@/hooks/useAsync";
import { toneClass } from "@/lib/badges";
import { formatCurrency, formatDateTime, humanize } from "@/lib/format";
import { adminClient } from "../client";

export function Payments() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const data = useAsync(() => adminClient.payments(page, status), [page, status]);

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Every Razorpay order and purchase. Refunds are made from the user's page so they are tied to the account and audited." />
      <Select
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(0);
        }}
        aria-label="Filter by status"
      >
        <option value="">All statuses</option>
        <option value="paid">Paid</option>
        <option value="created">Open (not paid)</option>
        <option value="failed">Failed</option>
        <option value="refunded">Refunded</option>
        <option value="partially_refunded">Partially refunded</option>
      </Select>
      <Card>
        <CardContent className="p-0">
          <DataState
            loading={data.loading}
            error={data.error}
            data={data.data?.payments}
            onRetry={data.refetch}
            skeleton={<SkeletonRows rows={8} cols={7} />}
            empty={<EmptyState icon={CreditCard} title="No payments" description="Nothing matches this filter yet." />}
          >
            {(rows) => (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Created</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Invoice or order</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(p.createdAt)}</TableCell>
                        <TableCell>
                          {p.userId ? (
                            <Link to={`/users/${p.userId}`} className="hover:underline">
                              {p.email}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">{p.email || "Deleted user"}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{p.number || p.orderId}</TableCell>
                        <TableCell>
                          {humanize(p.plan)} ({p.interval})
                        </TableCell>
                        <TableCell>{p.method ? humanize(p.method) : "-"}</TableCell>
                        <TableCell>
                          <Badge tone={toneClass(p.status === "paid" ? "emerald" : p.status === "open" ? "amber" : p.status === "failed" ? "red" : "slate")}>
                            {humanize(p.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(p.amount, p.currency)}
                          {p.refunded > 0 && <span className="block text-xs text-muted-foreground">-{formatCurrency(p.refunded, p.currency)} refunded</span>}
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
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={!data.data || data.data.payments.length < data.data.pageSize} onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
