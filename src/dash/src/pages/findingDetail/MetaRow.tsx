import type { ReactNode } from "react";

export interface MetaRowProps {
  label: string;
  children: ReactNode;
}

export function MetaRow({ label, children }: MetaRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{children}</span>
    </div>
  );
}
