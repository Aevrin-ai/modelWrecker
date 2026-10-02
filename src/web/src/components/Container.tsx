import type { ReactNode } from "react";
import { cn } from "../lib/cn";

// Folio content column: about 1216px wide with a 24px gutter.
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1264px] px-6", className)}>{children}</div>;
}
