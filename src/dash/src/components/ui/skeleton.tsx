import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Shimmer placeholder. Uses the .skeleton utility from index.css. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-md", className)} {...props} />;
}
