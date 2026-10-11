import { useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { useAutoplay } from "@/hooks/use-autoplay";
import { Section, SectionIntro } from "@/components/ui/blocks";
import { Reveal } from "@/components/ui/reveal";
import { PaintedPanel } from "@/components/ui/scene";
import { AddLine } from "@/components/ui/solar-icons";
import { EASE } from "@/components/mockups/tokens";
import { RunMockup } from "@/components/mockups/run-mockup";

/*
  How a run works, told as six steps beside the run itself. The list and the
  window share one phase: the steps open one at a time as the run plays, and
  picking a step jumps the window to it (and stops the autoplay).
*/

function Code({ children }: { children: ReactNode }) {
  return <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>;
}

const STEPS: { title: string; text: ReactNode }[] = [
  {
    title: "Describe the campaign.",
    text: (
      <>
        A YAML file (a simple text file of settings) says what to test, what to try, like 'leak the system prompt',
        and which model plays which role. Start it with <Code>modelwrecker run</Code>.
      </>
    ),
  },
  { title: "Plan the attacks.", text: "The planner picks attack strategies for each goal." },
  { title: "Send them.", text: "Each strategy writes attack messages and sends them to the target, the AI you are testing." },
  { title: "Judge each reply.", text: "The judge reads the reply and decides if the attack worked." },
  { title: "Replay the wins.", text: "A win is tried again several times to see how often it really works." },
  { title: "Write the finding.", text: "A confirmed weak spot becomes a finding with its proof attached." },
];

// Seconds each step holds. Typing the campaign takes longest; the finding,
// the payoff, holds before the run starts over.
const DURATIONS = [4.6, 3.0, 3.0, 2.4, 3.0, 3.6];

export function Run() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const live = useInView(ref, { amount: 0.35 });
  const { phase, setPhase } = useAutoplay(ref, DURATIONS);

  return (
    <Section id="how-it-works" labelledBy="run-heading">
      <SectionIntro
        id="run-heading"
        title="How a run works"
        lead="You write one small file. modelWrecker does the rest on your own machine, against AI systems you own or are allowed to test."
      />

      <div
        ref={ref}
        className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start"
      >
        <Reveal>
          <ol className="space-y-3">
            {STEPS.map((step, i) => {
              const open = i === phase;
              return (
                <li key={step.title} className="bg-card rounded-2xl shadow-edge dark:ring-1 dark:ring-white/10">
                  <h3>
                    <button
                      type="button"
                      onClick={() => setPhase(i)}
                      aria-expanded={open}
                      aria-controls={`run-step-${i}`}
                      className="text-foreground focus-visible:ring-ring flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left text-[17px] font-semibold focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums transition-colors duration-300",
                          open ? "bg-lime text-slate-950" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">{step.title}</span>
                      <AddLine
                        aria-hidden="true"
                        className={cn(
                          "text-muted-foreground size-5 shrink-0 transition-transform duration-200",
                          open && "rotate-45",
                        )}
                      />
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        id={`run-step-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: reduce ? 0 : 0.3, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <p className="text-muted-foreground px-5 pb-5 pl-16 text-base leading-relaxed text-pretty">{step.text}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ol>
        </Reveal>

        <Reveal delay={0.05}>
          <PaintedPanel scene="sky" className="px-3 py-8 sm:px-8 sm:py-10">
            <RunMockup phase={phase} live={live} />
          </PaintedPanel>
        </Reveal>
      </div>
    </Section>
  );
}
