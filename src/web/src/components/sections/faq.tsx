import type { ReactNode } from "react";

import { Section } from "@/components/ui/blocks";
import { Reveal } from "@/components/ui/reveal";
import { FaqQuestion } from "./faq-question";

function Cmd({ children }: { children: ReactNode }) {
  return <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>;
}

const QUESTIONS: { question: string; answer: ReactNode }[] = [
  {
    question: "What does modelWrecker test?",
    answer: "Chatbots, LLM APIs, AI agents, RAG pipelines, and tools connected through MCP, as long as you own them or are allowed to test them.",
  },
  {
    question: "Where do the attacks run?",
    answer: "On your own machine, with your own model keys or a model you run yourself.",
  },
  {
    question: "What does the Aevrin cloud do?",
    answer: "Only sign-in, the dashboard, billing and plans. It never runs an attack. By default it gets a summary of each run; prompts and replies are sent only if you turn that on.",
  },
  {
    question: "How do I know a finding is real?",
    answer: "A separate judge decides if an attack worked, and it is checked on harmless examples first. Then a success is replayed several times to see how often it really works. A one-off success is not a finding.",
  },
  {
    question: "What do I need to start?",
    answer: (
      <>
        Install it with <Cmd>pip install modelwrecker</Cmd>, write a short YAML campaign file, and run{" "}
        <Cmd>modelwrecker run</Cmd>.
      </>
    ),
  },
  {
    question: "Can I test any AI I find?",
    answer: "No. Only AI systems you own or are allowed to test. modelWrecker will not attack a target unless your campaign file marks it as authorized.",
  },
];

// the questions people ask before they start: one card per question in a narrow column
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
            <FaqQuestion key={item.question} question={item.question} answer={item.answer} delay={i * 0.04} />
          ))}
        </ul>
      </div>
    </Section>
  );
}
