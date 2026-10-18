import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsSummary } from "@/types";

export interface TaxonomyCoverageCardProps {
  byTaxonomy: AnalyticsSummary["byTaxonomy"];
}

export function TaxonomyCoverageCard({ byTaxonomy }: TaxonomyCoverageCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Taxonomy coverage</CardTitle>
        <CardDescription>Findings mapped to OWASP and MITRE ATLAS.</CardDescription>
      </CardHeader>
      <CardContent>
        {byTaxonomy.length === 0 ? (
          <p className="text-sm text-muted-foreground">No mapped findings yet.</p>
        ) : (
          <ul className="space-y-3">
            {byTaxonomy.map((entry) => (
              <li key={`${entry.framework}-${entry.id}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-mono text-xs">{entry.id}</span>{" "}
                  <span className="text-muted-foreground">{entry.title}</span>
                </span>
                <span className="font-medium tabular-nums">{entry.count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
