import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// kept apart from the kit with no animation library, so the hero can use these without loading motion up front

const TAG = {
  plain: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  bad: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  warn: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  good: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  info: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  lime: "bg-lime/30 text-slate-900 dark:bg-lime/20 dark:text-lime",
} as const;

export interface TagProps {
  tone?: keyof typeof TAG;
  className?: string;
  children: ReactNode;
}

// a small rounded label: what kind of thing, or which family
export function Tag({ tone = "plain", className, children }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[12px] font-semibold tracking-wide whitespace-nowrap",
        TAG[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type Severity = "Critical" | "High" | "Medium" | "Low";
const SEVERITY: Record<Severity, string> = {
  Critical: "bg-critical/10 text-critical ring-critical/25",
  High: "bg-high/10 text-high ring-high/25",
  Medium: "bg-medium/10 text-medium ring-medium/25",
  Low: "bg-low/10 text-low ring-low/25",
};
export interface SeverityTagProps {
  level: Severity;
  className?: string;
}

// always the word with the colour, since colour alone would hide the severity from anyone who cannot see it
export function SeverityTag({ level, className }: SeverityTagProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-semibold tracking-wide whitespace-nowrap ring-1 ring-inset",
        SEVERITY[level],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {level}
    </span>
  );
}
