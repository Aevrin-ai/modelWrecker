import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { Reveal } from "@/components/ui/reveal";
import { AddLine } from "@/components/ui/solar-icons";
import { EASE } from "@/components/mockups/tokens";

export interface FaqQuestionProps {
  question: string;
  answer: ReactNode;
  delay: number;
}

// a real disclosure button, so it works from the keyboard and tells a screen reader whether it is open
export function FaqQuestion({ question, answer, delay }: FaqQuestionProps) {
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
          onClick={() => setOpen((isOpen) => !isOpen)}
          className="text-foreground focus-visible:ring-ring flex min-h-[68px] w-full items-center justify-between gap-4 rounded-lg py-5 text-left text-base font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          {question}
          <AddLine
            aria-hidden="true"
            className={cn("text-muted-foreground size-5 shrink-0 transition-transform duration-200", open && "rotate-45")}
          />
        </button>
      </h3>
      {/* always in the page so aria-controls points at something; the answer mounts when it opens */}
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
              <p className="text-muted-foreground pb-5 text-base leading-relaxed text-pretty">{answer}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reveal>
  );
}
