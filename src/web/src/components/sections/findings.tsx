import { FeatureColumns, Section, SectionIntro } from "@/components/ui/blocks";
import { PaintedPanel } from "@/components/ui/scene";
import { Reveal } from "@/components/ui/reveal";
import { FindingMockup } from "@/components/mockups/finding-mockup";

/*
  The payoff, laid out like Activepieces' feature stage: the heading and lead,
  a painted stage with the finding report on it, then three short points on
  what every finding carries.
*/

const POINTS = [
  { title: "How bad it is", text: "Critical, High, Medium or Low, always written out, never colour alone." },
  { title: "What kind of problem", text: "Matched to an OWASP-style category." },
  { title: "The exact words", text: "The prompt sent and the reply received, for every attempt." },
] as const;

export function Findings() {
  return (
    <Section id="findings" labelledBy="findings-heading" className="flex flex-col gap-12">
      <SectionIntro
        id="findings-heading"
        title="Proof for every finding."
        lead="Every finding shows how bad it is, what kind of problem it is, and the exact message and reply for every try."
      />
      <Reveal>
        <PaintedPanel scene="meadow" className="px-4 py-10 sm:px-10 md:py-12">
          <FindingMockup />
        </PaintedPanel>
      </Reveal>
      <FeatureColumns items={POINTS} />
    </Section>
  );
}
