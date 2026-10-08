import { cn } from "@/lib/utils";

// The Aevrin mark with the product name beside it.
export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("text-foreground inline-flex items-center gap-2 text-[19px] font-semibold tracking-tight", className)}>
      <img src="/aevrin-logo.png" alt="" width={26} height={28} className={cn("h-7 w-auto shrink-0", markClassName)} />
      modelWrecker
    </span>
  );
}
