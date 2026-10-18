import { cn } from "@/lib/utils";

export interface PlaceholderBarProps {
  width: string;
  className?: string;
}

// a blank line of text: the windows are scenery, so most of what they hold is placeholder
export function PlaceholderBar({ width, className }: PlaceholderBarProps) {
  return <span className={cn("block h-2.5 rounded-full bg-slate-200 dark:bg-white/10", className)} style={{ width }} />;
}
