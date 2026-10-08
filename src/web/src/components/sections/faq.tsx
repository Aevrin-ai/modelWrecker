import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { Section } from "@/components/ui/blocks";
import { Reveal } from "@/components/ui/reveal";
import { AddLine } from "@/components/ui/solar-icons";
import { EASE } from "@/components/mockups/tokens";

/*
  The questions people ask before they start, the way Activepieces asks
  theirs: one card per question in a narrow column, a plus that turns into a
  cross when the answer is open. Each question is a real disclosure button,
  so it works from the keyboard and tells a screen reader whether it is open.
*/

function Cmd({ children }: { children: ReactNode }) {
  return <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>;
}

const QUESTIONS: { q: string; a: ReactNode }[] = [
  {
    q: "What does modelWrecker test?",
    a: "Chatbots, LLM APIs, AI agents, RAG pipelines, and tools connected through MCP, as long as you own them or are allowed to test them.",
  },
  {
    q: "Where do the attacks run?",
    a: "On your own machine, with your own model keys or a model you run yourself.",
  },
  {
    q: "What does the Aevrin cloud do?",
    a: "Only sign-in, the dashboard, billing and plans. It never runs an attack. By default it gets a summary of each run; prompts and replies are sent only if you turn that on.",
  },
  {
    q: "How do I know a finding is real?",
    a: "A separate judge decides if an attack worked, and it is checked on harmless examples first. Then a success is replayed several times to see how often it really works. A one-off success is not a finding.",
  },
  {
    q: "What do I need to start?",
    a: (
      <>
        Install it with <Cmd>pip install modelwrecker</Cmd>, write a short YAML campaign file, and run{" "}
        <Cmd>modelwrecker run</Cmd>.
      </>
    ),
  },
  {
    q: "Can I test any AI I find?",
    a: "No. Only AI systems you own or are allowed to test. modelWrecker will not attack a target unless your campaign file marks it as authorized.",
  },
];

function Question({ q, a, delay }: { q: string; a: ReactNode; delay: number }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const id = useId();
  const buttonId = `${id}-q`;
  const panelId = `${id}-a`;

  return (
    <Reveal as="li" delay={delay} y={12} className="bg-card rounded-2xl px-6 shadow-edge dark:ring-1 dark:ring-white/10">
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="text-foreground focus-visible:ring-ring flex min-h-[68px] w-full items-center justify-between gap-4 rounded-lg py-5 text-left text-base font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          {q}
          <AddLine
            aria-hidden="true"
            className={cn("text-muted-foreground size-5 shrink-0 transition-transform duration-200", open && "rotate-45")}
          />
        </button>
      </h3>
      {/* Always in the page, so aria-controls points at something even while
          the answer is closed; the answer itself mounts when it opens. */}
      <div id={panelId}>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.25, ease: EASE }}
              className="overflow-hidden"
            >
              <p className="text-muted-foreground pb-5 text-base leading-relaxed text-pretty">{a}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reveal>
  );
}

export function Faq() {
  return (
    <Section id="faq" labelledBy="faq-heading">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <h2 id="faq-heading" className="font-heading text-foreground text-3xl leading-tight font-bold md:text-4xl">
            Questions, answered.
          </h2>
        </Reveal>
        <ul className="mt-8 flex flex-col gap-3">
          {QUESTIONS.map((item, i) => (
            <Question key={item.q} q={item.q} a={item.a} delay={i * 0.04} />
          ))}
        </ul>
      </div>
    </Section>
  );
}
