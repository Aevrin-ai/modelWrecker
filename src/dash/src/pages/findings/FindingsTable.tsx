import { Card } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Finding } from "@/types";
import { FindingRow } from "./FindingRow";

export interface FindingsTableProps {
  findings: Finding[];
}

export function FindingsTable({ findings }: FindingsTableProps) {
  return (
      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Finding</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Strategy</TableHead>
              <TableHead>Reliability</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Found</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {findings.map((finding) => (
              <FindingRow key={finding.id} finding={finding} />
            ))}
          </TableBody>
        </Table>
      </Card>
  );
}
