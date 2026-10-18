import type { ReactNode } from "react";

export interface BillingRowProps {
  label: string;
  children: ReactNode;
}

export function BillingRow({ label, children }: BillingRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
