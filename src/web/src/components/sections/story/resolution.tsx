import { cn } from "@/lib/utils";

export interface ResolutionProps {
  heading?: "h2" | "h3";
  id?: string;
  compact?: boolean;
}

export function Resolution({ heading: Heading = "h3", id, compact }: ResolutionProps) {
  return (
    <div className="mx-auto text-center">
      <div className="flex items-center justify-center gap-3 md:gap-4">
        <img
          src="/aevrin-logo.png"
          alt=""
          width={26}
          height={28}
          className={cn("w-auto", compact ? "h-10" : "h-12 md:h-16")}
        />
        <span
          className={cn(
            "text-foreground font-semibold tracking-tight",
            compact ? "text-[32px]" : "text-5xl md:text-6xl",
          )}
        >
          modelWrecker
        </span>
      </div>
      <Heading
        id={id}
        className={cn(
          "font-heading text-foreground mx-auto mt-5 max-w-[13ch] leading-[1.04] font-bold text-balance",
          compact ? "text-[clamp(2.25rem,9.5vw,3rem)]" : "text-5xl md:text-7xl",
        )}
      >
        Find the weak spots first.
      </Heading>
    </div>
  );
}
