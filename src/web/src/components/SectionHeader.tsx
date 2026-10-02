import type { ReactNode } from "react";
import { Reveal } from "./Reveal";
import { cn } from "../lib/cn";

// Folio section header: optional mono eyebrow, a large bold serif headline on
// the left, and a muted paragraph in the right column.
export function SectionHeader({
  eyebrow,
  title,
  description,
  className,
  serif = true,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  serif?: boolean;
}) {
  return (
    <div className={cn("grid gap-6 md:grid-cols-2 md:items-end md:gap-12", className)}>
      <Reveal>
        {eyebrow && <p className="eyebrow mb-5">{eyebrow}</p>}
        <h2
          className={cn(
            "text-balance text-4xl text-foreground md:text-5xl",
            serif ? "h-section" : "font-medium tracking-[-0.025em]"
          )}
        >
          {title}
        </h2>
      </Reveal>
      {description && (
        <Reveal delay={0.08}>
          <p className="max-w-xl text-balance text-lg leading-relaxed text-muted">{description}</p>
        </Reveal>
      )}
    </div>
  );
}
