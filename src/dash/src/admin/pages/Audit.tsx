import { useState } from "react";
import { Link } from "react-router-dom";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime } from "@/lib/format";
import { adminClient } from "../client";
import { actionLabel, detailSummary } from "./shared";

export function Audit() {
  const [page, setPage] = useState(0);
  const data = useAsync(() => adminClient.audit(page), [page]);
  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="Every admin sign-in and every change made in this console: who, when, to whom, and why. Entries cannot be edited or deleted here." />
      <Card>
        <CardContent className="p-0">
          <DataState
            loading={data.loading}
            error={data.error}
            data={data.data?.entries}
            onRetry={data.refetch}
            skeleton={<SkeletonRows rows={8} cols={5} />}
            empty={<EmptyState icon={ScrollText} title="Nothing yet" description="Admin actions appear here." />}
          >
            {(rows) => (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Reason and detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(a.createdAt)}</TableCell>
                        <TableCell>{a.adminEmail}</TableCell>
                        <TableCell className="whitespace-nowrap font-medium">{actionLabel(a.action)}</TableCell>
                        <TableCell>
                          {a.targetUserId && a.targetEmail ? (
                            <Link to={`/users/${a.targetUserId}`} className="hover:underline">
                              {a.targetEmail}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">{a.targetEmail ?? "-"}</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-md">
                          {a.reason && <p>{a.reason}</p>}
                          {Object.keys(a.detail).length > 0 && <p className="font-mono text-xs text-muted-foreground">{detailSummary(a.detail)}</p>}
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
        <Button variant="outline" size="sm" disabled={!data.data || data.data.entries.length < data.data.pageSize} onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
