import type { ReactNode } from "react";

export interface TooltipBoxProps {
  children: ReactNode;
}

export function TooltipBox({ children }: TooltipBoxProps) {
  return <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-popover">{children}</div>;
}
