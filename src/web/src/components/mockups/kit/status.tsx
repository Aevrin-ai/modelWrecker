import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const STATUS = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
  info: "bg-sky-500",
  idle: "bg-slate-300 dark:bg-slate-600",
} as const;

export interface StatusProps {
  tone?: keyof typeof STATUS;
  children: ReactNode;
  className?: string;
}

// a coloured dot and a word: the status of a row at a glance
export function Status({ tone = "good", children, className }: StatusProps) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2 text-[15px] text-slate-700 dark:text-slate-300", className)}>
      <span className={cn("size-2 rounded-full", STATUS[tone])} />
      {children}
    </span>
  );
}
