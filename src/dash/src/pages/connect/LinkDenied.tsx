import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LinkDeniedProps {
  onReset: () => void;
}

export function LinkDenied({ onReset }: LinkDeniedProps) {
  return (
    <div role="status" className="space-y-3 rounded-md border p-4">
      <p className="flex items-start gap-2 text-sm font-medium">
        <XCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        Denied. That engine will not get a token. Run modelwrecker login again if this was a mistake.
      </p>
      <Button variant="outline" size="sm" onClick={onReset}>
        Enter another code
      </Button>
    </div>
  );
}
