import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TaxonomyRef } from "@/types";

export interface TaxonomyCardProps {
  taxonomy: TaxonomyRef[];
}

export function TaxonomyCard({ taxonomy }: TaxonomyCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Taxonomy</CardTitle>
        <CardDescription>Mapped security frameworks.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {taxonomy.map((taxonomyRef, i) => (
          <Badge key={i} tone="bg-brand/10 text-brand" className="font-mono">
            {taxonomyRef.id}
            {taxonomyRef.title ? ` ${taxonomyRef.title}` : ""}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}
