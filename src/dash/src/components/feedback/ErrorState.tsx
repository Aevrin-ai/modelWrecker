import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ErrorStateProps {
  error?: Error; // accepted for logging hooks later
  title?: string;
  onRetry?: () => void;
  action?: ReactNode;
}

// never shows a raw backend message or stack trace: it says what failed and offers a retry
export function ErrorState({ title = "Unable to load this data.", onRetry, action }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-10 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          The control plane did not answer. Your local engine keeps working and its results will sync
          when the connection returns.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="size-4" />
            Retry
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}
