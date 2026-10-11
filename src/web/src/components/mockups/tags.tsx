import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
  Labels the mockups share: a tag and a severity. Kept apart from kit.tsx, with no animation library, so the
  hero can use them without pulling motion into the first download.
*/

// A small rounded label: what kind of thing, or which family.
const TAG = {
  plain: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  bad: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  warn: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  good: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  info: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  lime: "bg-lime/30 text-slate-900 dark:bg-lime/20 dark:text-lime",
} as const;

export function Tag({ tone = "plain", className, children }: { tone?: keyof typeof TAG; className?: string; children: ReactNode }) {
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

/*
  How serious a finding is. The same four colours everywhere on the site, and
  always with the word: colour alone would hide it from anyone who cannot see
  the colour.
*/
export type Severity = "Critical" | "High" | "Medium" | "Low";
const SEVERITY: Record<Severity, string> = {
  Critical: "bg-critical/10 text-critical ring-critical/25",
  High: "bg-high/10 text-high ring-high/25",
  Medium: "bg-medium/10 text-medium ring-medium/25",
  Low: "bg-low/10 text-low ring-low/25",
};
export function SeverityTag({ level, className }: { level: Severity; className?: string }) {
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
