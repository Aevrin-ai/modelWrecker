import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function JsonKey({ children }: { children: ReactNode }) {
  return <span className="text-sky-700 dark:text-sky-300">{children}</span>;
}

export function JsonString({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("text-amber-700 dark:text-amber-300", className)}>{children}</span>;
}
