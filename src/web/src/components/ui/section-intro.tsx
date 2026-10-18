import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Reveal } from "@/components/ui/reveal";

export interface SectionIntroProps {
  title: ReactNode;
  lead?: ReactNode;
  id?: string;
  layout?: "split" | "stacked";
  titleClassName?: string;
  leadClassName?: string;
  className?: string;
  children?: ReactNode;
}

// a bold serif heading and a lead: `split` sets the lead beside the heading on a wide screen, `stacked` beneath
export function SectionIntro({
  title,
  lead,
  id,
  layout = "split",
  titleClassName = "max-w-[16ch]",
  leadClassName = "max-w-[44ch]",
  className,
  children,
}: SectionIntroProps) {
  const split = layout === "split";
  return (
    <Reveal
      className={cn(split && "flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-16", className)}
    >
      <h2
        id={id}
        className={cn(
          "font-heading text-foreground text-4xl leading-[1.05] font-bold text-balance md:text-5xl",
          titleClassName,
        )}
      >
        {title}
      </h2>
      {(lead || children) && (
        <div className={cn(!split && "mt-5", leadClassName)}>
          {lead && <p className="text-muted-foreground text-lg leading-relaxed text-pretty md:text-xl md:leading-[1.4]">{lead}</p>}
          {children}
        </div>
      )}
    </Reveal>
  );
}
