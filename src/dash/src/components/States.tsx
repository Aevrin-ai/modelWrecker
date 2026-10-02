/*
  Standard empty / error / loading states, plus a DataState wrapper that drives the
  skeleton -> content -> error -> empty flow from a useAsync result. Every list and
  detail page uses these so the states look the same everywhere.
*/

import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed p-10 text-center",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * A friendly load-failure state. It never shows a raw backend message or stack trace;
 * it says what failed and offers a retry. `error` is accepted for logging hooks later.
 */
export function ErrorState({
  title = "Unable to load this data.",
  onRetry,
  action,
}: {
  error?: Error;
  title?: string;
  onRetry?: () => void;
  action?: ReactNode;
}) {
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

/** A grid of skeleton cards for the loading state of card layouts. */
export function SkeletonCards({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-8 w-32" />
          <Skeleton className="mt-3 h-3 w-40" />
        </Card>
      ))}
    </div>
  );
}

/** A skeleton table body. */
export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y rounded-md border">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 p-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-4", c === 0 ? "w-40" : "w-20")} />
          ))}
        </div>
      ))}
    </div>
  );
}

interface DataStateProps<T> {
  loading: boolean;
  error: Error | null;
  data: T | null | undefined;
  onRetry?: () => void;
  /** Plain-language error heading, e.g. "Unable to load campaigns." */
  errorTitle?: string;
  skeleton?: ReactNode;
  /** When data is an empty array (or isEmpty returns true), show this instead. */
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}

/** Drives the standard async flow. Keeps every page's state handling identical. */
export function DataState<T>({
  loading,
  error,
  data,
  onRetry,
  errorTitle,
  skeleton,
  empty,
  isEmpty,
  children,
}: DataStateProps<T>) {
  if (loading && data == null) return <>{skeleton ?? <SkeletonCards count={4} className="sm:grid-cols-2" />}</>;
  if (error) return <ErrorState error={error} title={errorTitle} onRetry={onRetry} />;
  if (data == null) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  const emptyCheck = isEmpty
    ? isEmpty(data)
    : Array.isArray(data) && (data as unknown[]).length === 0;
  if (emptyCheck && empty) return <>{empty}</>;
  return <>{children(data)}</>;
}
