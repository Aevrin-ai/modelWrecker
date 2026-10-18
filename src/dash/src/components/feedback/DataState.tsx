import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { SkeletonCards } from "./SkeletonCards";

export interface DataStateProps<T> {
  loading: boolean;
  error: Error | null;
  data: T | null | undefined;
  onRetry?: () => void;
  errorTitle?: string; // plain-language heading, e.g. "Unable to load campaigns."
  skeleton?: ReactNode;
  empty?: ReactNode; // shown when data is an empty array, or isEmpty returns true
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}

// the standard skeleton -> content -> error -> empty flow, so every page handles async state the same way
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
