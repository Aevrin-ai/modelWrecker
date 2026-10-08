import { ArrowRight } from "lucide-react";

import { AEVRIN_URL } from "@/lib/links";
import { Section } from "@/components/ui/blocks";
import { Reveal } from "@/components/ui/reveal";

/*
  Where modelWrecker belongs, set the way Activepieces sets a customer quote:
  one centred serif line, the key phrase dark and the rest muted, with no
  quote and no numbers. Users meet the product as Aevrin, so the line says so.
*/
export function PartOfAevrin() {
  return (
    <Section id="aevrin" labelledBy="aevrin-heading">
      <Reveal className="mx-auto flex max-w-[1024px] flex-col items-center text-center">
        <span className="text-foreground inline-flex items-center gap-2 text-[19px] font-semibold tracking-tight">
          <img src="/aevrin-logo.png" alt="" width={26} height={28} className="h-8 w-auto" />
          Aevrin
        </span>
        <h2
          id="aevrin-heading"
          className="font-heading text-muted-foreground mt-8 text-[length:clamp(1.5rem,3.125vw_+_1px,2.5625rem)] leading-[1.1] font-bold text-balance"
        >
          modelWrecker is <span className="text-foreground">the AI red-teaming part</span> of the Aevrin security platform.
        </h2>
        <p className="text-muted-foreground mt-6 text-base">In the app you will see it as Aevrin.</p>
        <a
          href={AEVRIN_URL}
          target="_blank"
          rel="noreferrer"
          className="group text-foreground hover:text-brand mt-4 inline-flex min-h-11 items-center gap-1.5 text-base font-medium transition-colors"
        >
          Visit aevrin.net
          <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
        </a>
      </Reveal>
    </Section>
  );
}
