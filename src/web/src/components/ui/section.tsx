import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SectionProps {
  id?: string;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}

// the space a big section takes: 128px above and below on a laptop, 96 on a phone
export function Section({ id, labelledBy, className, children }: SectionProps) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("max-w-container scroll-mt-24 py-24 md:py-32", className)}>
      {children}
    </section>
  );
}
