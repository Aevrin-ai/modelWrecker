import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Scene, type SceneName } from "@/components/ui/scene";
import { Reveal } from "@/components/ui/reveal";

export interface BentoCardProps {
  title: ReactNode;
  description?: ReactNode;
  scene?: SceneName;
  className?: string;
  children: ReactNode;
  delay?: number;
  fit?: boolean;
}

// a list panel runs off the edges like a cropped screenshot; a grid (`fit`) stays inside, since cropping cuts a column
export function BentoCard({
  title,
  description,
  scene = "sky",
  className,
  children,
  delay = 0,
  fit = false,
}: BentoCardProps) {
  return (
    <Reveal
      as="article"
      delay={delay}
      className={cn(
        "bg-card flex h-[460px] flex-col overflow-hidden rounded-2xl shadow-edge md:h-[500px] dark:ring-1 dark:ring-white/10",
        className,
      )}
    >
      <div className="px-5 pt-6 pb-5 sm:px-6">
        <h3 className="text-foreground text-xl leading-snug font-medium tracking-tight">{title}</h3>
        {description && <p className="text-muted-foreground mt-1.5 text-[15px] leading-relaxed text-pretty">{description}</p>}
      </div>
      <div className="relative isolate min-h-0 flex-1 overflow-hidden">
        <Scene name={scene} />
        <div className={cn("absolute", fit ? "inset-5 md:inset-7" : "top-6 left-5 -right-8 -bottom-10 md:top-9 md:left-9 md:-bottom-12")}>
          {children}
        </div>
      </div>
    </Reveal>
  );
}
