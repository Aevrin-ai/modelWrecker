import { useRef } from "react";

import { cn } from "@/lib/utils";
import { useAutoplay } from "@/hooks/use-autoplay";
import { FeatureColumns, Section, SectionIntro } from "@/components/ui/blocks";
import { Reveal } from "@/components/ui/reveal";
import { PaintedPanel } from "@/components/ui/scene";
import { Book, ChatRoundDots, Database, Layers, type IconComponent } from "@/components/ui/solar-icons";

/*
  The 14 attack strategies, grouped into their four families on a painted
  stage, the way Activepieces lays out its pieces. The names are real text,
  not a picture, so everyone can read the whole list. While the stage is on
  screen a soft ring walks from family to family; for anyone who asked for
  less motion it stays still.
*/

const FAMILIES: { title: string; icon: IconComponent; strategies: string[]; text: string }[] = [
  {
    title: "One message",
    icon: ChatRoundDots,
    strategies: ["simple jailbreaks", "prompt extraction"],
    text: "Short, direct tries, like asking the AI to show its hidden instructions.",
  },
  {
    title: "A longer push",
    icon: Layers,
    strategies: ["crescendo", "many-shot", "best-of-N", "prefill", "encoded jailbreaks"],
    text: "Attacks that build up over many turns, try many versions, or hide the ask in a different form.",
  },
  {
    title: "From research",
    icon: Book,
    strategies: ["PAIR (PyRIT-based)", "TAP (PyRIT-based)", "PyRIT-based send", "garak probes"],
    text: "Methods from published security research: PAIR and TAP (PyRIT-based), a PyRIT-based send, and garak probes.",
  },
  {
    title: "Tools and data",
    icon: Database,
    strategies: ["tool misuse", "RAG injection", "MCP tool poisoning"],
    text: "Attacks on the tools, documents and plug-ins an AI uses.",
  },
];

// Seconds the ring rests on each family, the last a little longer.
const DURATIONS = [2.4, 2.4, 2.4, 3.0];

export function Attacks() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase, playing } = useAutoplay(ref, DURATIONS);
  const lit = playing ? phase : -1;

  return (
    <Section id="attacks" labelledBy="attacks-heading">
      <SectionIntro
        id="attacks-heading"
        title="14 ways to attack, in four families."
        lead="Some attacks take one message. Some take a whole conversation. Some go after the tools and documents around the AI."
      />

      <Reveal delay={0.05} className="mt-12">
        <PaintedPanel scene="meadow" className="p-4 sm:p-8 lg:p-12">
          <div ref={ref} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {FAMILIES.map((family, i) => {
              const Icon = family.icon;
              const on = lit === i;
              return (
                <div
                  key={family.title}
                  className={cn(
                    "rounded-2xl bg-white/80 p-5 text-slate-900 ring-1 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_32px_-16px_rgba(15,23,42,0.35)] backdrop-blur-md transition-[box-shadow,background-color] duration-500 dark:bg-slate-900/80 dark:text-slate-100",
                    on ? "ring-lime ring-2" : "ring-slate-900/10 dark:ring-white/10",
                  )}
                >
                  <p id={`attack-family-${i}`} className="flex items-center gap-3 text-[17px] font-semibold">
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-lg transition-colors duration-500",
                        on ? "bg-lime text-slate-950" : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
                      )}
                    >
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    {family.title}
                  </p>
                  <ul aria-labelledby={`attack-family-${i}`} className="mt-4 flex flex-wrap gap-2">
                    {family.strategies.map((name) => (
                      <li
                        key={name}
                        className="rounded-full bg-white px-3.5 py-1.5 text-[15px] font-medium text-slate-800 ring-1 shadow-[0_1px_2px_rgba(16,24,40,0.05)] ring-slate-900/10 dark:bg-slate-800 dark:text-slate-100 dark:ring-white/10"
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </PaintedPanel>
      </Reveal>

      <FeatureColumns items={FAMILIES.map(({ title, text }) => ({ title, text }))} className="mt-12" />
    </Section>
  );
}
