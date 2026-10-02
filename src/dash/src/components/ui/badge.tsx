import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Pass a soft tone class pair from lib/badges, or leave for the neutral default. */
  tone?: string;
}

/**
 * Catmint pill badge (measured): px-2 py-1, rounded-full, 12px regular text, soft -100/-800 tint.
 * The color is supplied as a `tone` class pair so callers stay consistent.
 */
export function Badge({ className, tone, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs leading-none font-normal whitespace-nowrap",
        tone ?? "bg-secondary text-secondary-foreground",
        className,
      )}
      {...props}
    />
  );
}
