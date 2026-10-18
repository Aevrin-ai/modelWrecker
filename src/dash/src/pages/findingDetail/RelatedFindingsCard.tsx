import { Link } from "react-router-dom";
import { GitBranch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface RelatedFindingsCardProps {
  findingIds: string[];
}

export function RelatedFindingsCard({ findingIds }: RelatedFindingsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="size-4" />
          Related findings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {findingIds.map((relatedId) => (
          <Link
            key={relatedId}
            to={`/findings/${relatedId}`}
            className="block rounded-md px-2 py-1.5 font-mono text-xs text-brand hover:bg-muted"
          >
            {relatedId}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
