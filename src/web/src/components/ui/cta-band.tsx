import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Reveal } from "@/components/ui/reveal";
import { CheckItem } from "@/components/ui/check-item";

export interface CtaBandProps {
  title: ReactNode;
  text?: ReactNode;
  points?: readonly string[];
  children: ReactNode;
  className?: string;
}

// a quiet band between sections that asks for the next step
export function CtaBand({ title, text, points, children, className }: CtaBandProps) {
  return (
    <Reveal className={cn("max-w-container py-12 md:py-16", className)}>
      <div className="bg-card flex flex-col gap-8 rounded-3xl p-7 shadow-edge sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12 dark:ring-1 dark:ring-white/10">
        <div className="min-w-0">
          <h2 className="font-heading text-foreground text-2xl leading-tight font-bold text-balance md:text-[28px]">{title}</h2>
          {text && <p className="text-muted-foreground mt-3 max-w-[60ch] text-base leading-relaxed text-pretty md:text-lg">{text}</p>}
          {points && (
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
              {points.map((point) => (
                <CheckItem key={point} className="text-sm">
                  {point}
                </CheckItem>
              ))}
            </ul>
          )}
        </div>
        {/* full-width stacked buttons on a phone; wider they keep to one row and never wrap beside the text */}
        <div className="flex flex-col gap-3 max-sm:*:w-full sm:flex-row sm:flex-wrap sm:items-center lg:shrink-0 lg:flex-nowrap">
          {children}
        </div>
      </div>
    </Reveal>
  );
}
