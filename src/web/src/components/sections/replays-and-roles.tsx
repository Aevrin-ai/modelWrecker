import { BentoCard, Section, SectionIntro } from "@/components/ui/blocks";
import { ReplaysMockup, RolesMockup } from "@/components/mockups/replays-mockup";

/*
  Why a result can be trusted: a win is replayed until its success rate is
  known, and the models that attack, get tested and judge are kept apart.
  Two cards side by side on a wide screen, stacked on a phone.
*/
export function ReplaysAndRoles() {
  return (
    <Section id="replays" labelledBy="replays-heading">
      <SectionIntro
        id="replays-heading"
        layout="stacked"
        title="Trust a result, not a lucky try."
        titleClassName="max-w-[20ch]"
      />

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-24 md:gap-5">
        <BentoCard
          className="md:col-span-12"
          fit
          scene="mist"
          title="Luck is not a finding"
          description="One win can be luck. modelWrecker replays it several times and shows how often it works, with a range for how sure it is."
        >
          <ReplaysMockup />
        </BentoCard>

        <BentoCard
          className="md:col-span-12"
          delay={0.05}
          fit
          scene="dusk"
          title="Three roles that never mix"
          description="Three separate models, with walls between them."
        >
          <RolesMockup />
        </BentoCard>
      </div>
    </Section>
  );
}
