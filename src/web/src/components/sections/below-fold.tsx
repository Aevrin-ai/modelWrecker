import { ArrowRight } from "lucide-react";

import { APP_URL, DEMO_URL } from "@/lib/links";
import { CtaBand } from "@/components/ui/blocks";
import { Pill } from "@/components/ui/pill";
import { Story } from "./story";
import { Tests } from "./tests";
import { Run } from "./run";
import { Attacks } from "./attacks";
import { Judge } from "./judge";
import { ReplaysAndRoles } from "./replays-and-roles";
import { Local } from "./local";
import { Findings } from "./findings";
import { PartOfAevrin } from "./part-of-aevrin";
import { Pricing } from "./pricing";
import { Faq } from "./faq";

/*
  The home page under the hero, in the order Activepieces tells theirs: the
  story, what it covers, how it works and why to trust it, the payoff, then
  the questions people ask before they start. Loaded as its own chunk.
*/

function CtaButtons() {
  return (
    <>
      <Pill href={APP_URL}>
        Open modelWrecker
        <ArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
      </Pill>
      <Pill variant="soft" href={DEMO_URL}>
        Request a demo
      </Pill>
    </>
  );
}

export default function BelowFold() {
  return (
    <>
      <Story />
      <Tests />
      <CtaBand
        title="See what breaks before your users do."
        text="Point modelWrecker at an AI you are allowed to test and get proof, not guesses."
      >
        <CtaButtons />
      </CtaBand>
      <Run />
      <Attacks />
      <Judge />
      <ReplaysAndRoles />
      <Local />
      <CtaBand title="Your keys. Your machine. Your proof." text="Run your first campaign in minutes.">
        <CtaButtons />
      </CtaBand>
      <Findings />
      <PartOfAevrin />
      <Pricing />
      <Faq />
    </>
  );
}
