import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ControlPlaneCalloutProps {
  title?: string;
  children?: ReactNode;
  className?: string;
}

export function ControlPlaneCallout({ title = "This is a control plane", children, className }: ControlPlaneCalloutProps) {
  return (
    <div className={cn("flex items-start gap-3 rounded-md border bg-muted/40 p-4", className)}>
      <ShieldCheck className="mt-0.5 size-5 shrink-0" />
      <div className="space-y-1 text-sm">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-muted-foreground">
          {children ??
            "The dashboard manages your red-team work and shows synced results. It never runs attacks, model calls, or tools. That work runs on your local ModelWrecker engine, which syncs metadata back here."}
        </p>
      </div>
    </div>
  );
}
