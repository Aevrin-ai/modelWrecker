import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Scene, type SceneName } from "@/components/ui/scene";
import { Reveal } from "@/components/ui/reveal";
import { CheckItem } from "@/components/ui/check-item";

export { CheckItem };

/*
  The repeating pieces of the page: the heading a section opens with, a card
  that names a feature above a panel showing it, a row of short points split by
  thin rules, a ticked list, and a band that asks for the next step.
*/

/*
  How a section opens: a bold serif heading and a lead. `split` sets the lead
  beside the heading on a wide screen, the way Activepieces does; `stacked`
  puts it beneath.
*/
export function SectionIntro({
  title,
  lead,
  id,
  layout = "split",
  titleClassName = "max-w-[16ch]",
  leadClassName = "max-w-[44ch]",
  className,
  children,
}: {
  title: ReactNode;
  lead?: ReactNode;
  id?: string;
  layout?: "split" | "stacked";
  titleClassName?: string;
  leadClassName?: string;
  className?: string;
  children?: ReactNode;
}) {
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

/*
  A card that names a feature above a panel showing it, on a painted scene. A
  list panel runs off the right and bottom edges, the way a window would be
  cropped in a screenshot; a grid (`fit`) sits wholly inside, since cropping
  it would cut a column in half.
*/
export function BentoCard({
  title,
  description,
  scene = "sky",
  className,
  children,
  delay = 0,
  fit = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  scene?: SceneName;
  className?: string;
  children: ReactNode;
  delay?: number;
  fit?: boolean;
}) {
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

// Three (or four) short points side by side, each a title and a sentence.
export function FeatureColumns({
  items,
  className,
}: {
  items: readonly { title: string; text: ReactNode }[];
  className?: string;
}) {
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

// A quiet band between sections that asks for the next step.
export function CtaBand({
  title,
  text,
  points,
  children,
  className,
}: {
  title: ReactNode;
  text?: ReactNode;
  points?: readonly string[];
  children: ReactNode;
  className?: string;
}) {
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
        {/* On a phone the buttons stack at full width; wider, they keep to one
            row, and beside the text they never wrap under each other. */}
        <div className="flex flex-col gap-3 max-sm:*:w-full sm:flex-row sm:flex-wrap sm:items-center lg:shrink-0 lg:flex-nowrap">
          {children}
        </div>
      </div>
    </Reveal>
  );
}

// The space a big section takes: 128px above and below on a laptop, 96 on a phone.
export function Section({
  id,
  labelledBy,
  className,
  children,
}: {
  id?: string;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("max-w-container scroll-mt-24 py-24 md:py-32", className)}>
      {children}
    </section>
  );
}
