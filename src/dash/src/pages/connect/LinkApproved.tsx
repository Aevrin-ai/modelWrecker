import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";

export interface LinkApprovedProps {
  onReset: () => void;
}

export function LinkApproved({ onReset }: LinkApprovedProps) {
  return (
    <div role="status" className="space-y-3 rounded-md border p-4">
      <p className="flex items-start gap-2 text-sm font-medium">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        Approved. Your engine will finish signing in within a few seconds.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link to="/devices" className={buttonClasses("default", "sm")}>
          View devices
        </Link>
        <Button variant="outline" size="sm" onClick={onReset}>
          Link another device
        </Button>
      </div>
    </div>
  );
}
