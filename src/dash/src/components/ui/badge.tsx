import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  // pass a soft tone class pair from lib/badges, or leave for the neutral default
  tone?: string;
}

// a soft pill badge; callers pass the color as a `tone` class pair so it stays consistent
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
