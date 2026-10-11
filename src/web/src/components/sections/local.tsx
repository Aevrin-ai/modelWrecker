import { CheckItem, Section, SectionIntro } from "@/components/ui/blocks";
import { PaintedPanel } from "@/components/ui/scene";
import { Reveal } from "@/components/ui/reveal";
import { LocalMockup } from "@/components/mockups/local-mockup";

/*
  Local-first: the attacks run on your own machine, and the Aevrin cloud only
  does sign-in, the dashboard, billing and plans. A feature stage: the heading,
  the picture of the two places, then three ticked points.
*/
const POINTS = [
  "Your keys or a local model",
  "The Aevrin cloud only handles sign-in, the dashboard, billing and plans",
  "The cloud never runs an attack",
] as const;

export function Local() {
  return (
    <Section id="local" labelledBy="local-heading">
      <SectionIntro
        id="local-heading"
        title="Your machine does the attacking."
        lead="Attacks run on your own computer, with your own model keys or a model you run yourself."
      />

      <Reveal className="mt-12">
        <PaintedPanel scene="glass" className="px-4 py-10 sm:px-8 md:p-12">
          <LocalMockup />
        </PaintedPanel>
      </Reveal>

      <ul className="mt-12 grid gap-4 md:grid-cols-3 md:gap-8">
        {POINTS.map((point) => (
          <CheckItem key={point} className="text-base">
            {point}
          </CheckItem>
        ))}
      </ul>
    </Section>
  );
}
