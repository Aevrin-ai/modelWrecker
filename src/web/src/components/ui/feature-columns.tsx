import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Reveal } from "@/components/ui/reveal";

export interface FeatureColumnsProps {
  items: readonly { title: string; text: ReactNode }[];
  className?: string;
}

// three (or four) short points side by side, each a title and a sentence
export function FeatureColumns({ items, className }: FeatureColumnsProps) {
  return (
    <ul
      className={cn(
        "grid gap-8 md:gap-0 md:divide-x md:divide-slate-950/10 dark:md:divide-white/10",
        items.length === 4 ? "sm:grid-cols-2 md:grid-cols-4" : "md:grid-cols-3",
        className,
      )}
    >
      {items.map((item, i) => (
        <Reveal as="li" key={item.title} delay={i * 0.06} y={16} className="md:px-6 md:first:pl-0 md:last:pr-0">
          <h3 className="text-foreground text-lg leading-snug font-semibold">{item.title}</h3>
          <p className="text-muted-foreground mt-2 text-base leading-relaxed text-pretty">{item.text}</p>
        </Reveal>
      ))}
    </ul>
  );
}
