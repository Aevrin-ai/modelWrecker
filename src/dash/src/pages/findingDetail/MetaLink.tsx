import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface MetaLinkProps {
  icon: LucideIcon;
  label: string;
  to: string;
  children: ReactNode;
}

export function MetaLink({ icon: Icon, label, to, children }: MetaLinkProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <Link to={to} className="truncate text-right font-medium text-brand hover:underline">
        {children}
      </Link>
    </div>
  );
}
