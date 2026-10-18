import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface BillingBannerProps {
  tone: "amber" | "red";
  children: ReactNode;
}

export function BillingBanner({ tone, children }: BillingBannerProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border p-3 text-sm",
        tone === "amber" ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100" : "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
