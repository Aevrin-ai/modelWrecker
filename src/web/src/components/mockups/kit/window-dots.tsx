import { cn } from "@/lib/utils";

export interface WindowDotsProps {
  className?: string;
}

// the red, amber and green buttons at the top of an app window
export function WindowDots({ className }: WindowDotsProps) {
  return (
    <span aria-hidden="true" className={cn("flex gap-1.5", className)}>
      <span className="size-[1em] rounded-full bg-[#ff5f57]" />
      <span className="size-[1em] rounded-full bg-[#febc2e]" />
      <span className="size-[1em] rounded-full bg-[#28c840]" />
    </span>
  );
}
