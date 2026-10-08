import { FeatureColumns, Section, SectionIntro } from "@/components/ui/blocks";
import { Reveal } from "@/components/ui/reveal";
import { PaintedPanel } from "@/components/ui/scene";
import { JudgeMockup } from "@/components/mockups/judge-mockup";

/*
  Why a "Worked" from modelWrecker means something: the judge is its own
  model, it is tested on harmless replies before it judges anything, and it
  weighs several signs instead of one guess.
*/

const POINTS = [
  {
    title: "Checked first",
    text: "Before it judges anything, it is tested on harmless examples, so it cannot make up findings.",
  },
  { title: "Many signals", text: "It weighs several signs, not one guess." },
  { title: "Never the attacker", text: "The model that attacks is never the model that judges." },
];

export function Judge() {
  return (
    <Section id="judge" labelledBy="judge-heading">
      <SectionIntro
        id="judge-heading"
        title="A judge you can trust."
        lead="The judge is a separate model that decides if an attack worked."
      />
      <Reveal delay={0.05} className="mt-12">
        <PaintedPanel scene="dusk" className="px-3 py-8 sm:px-10 sm:py-12 lg:py-16">
          <JudgeMockup />
        </PaintedPanel>
      </Reveal>
      <FeatureColumns items={POINTS} className="mt-12" />
    </Section>
  );
}
