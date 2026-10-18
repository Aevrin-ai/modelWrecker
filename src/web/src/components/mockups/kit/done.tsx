import { cn } from "@/lib/utils";
import { CheckCircleLine } from "@/components/ui/solar-icons";

export interface DoneProps {
  className?: string;
}

export function Done({ className }: DoneProps) {
  return <CheckCircleLine className={cn("size-5 shrink-0 text-emerald-600 dark:text-emerald-400", className)} />;
}
