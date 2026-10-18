import { Resolution } from "./resolution";
import { STATEMENT_CLASS } from "./statement";
import { StepGrid } from "./step-grid";

// reduced motion: the same three moments, one after another, holding still
export function StillStory() {
  return (
    <div className="max-w-container mx-auto space-y-24 py-24 md:py-32">
      <h2 id="story-heading" className={STATEMENT_CLASS}>
        Your AI talks to everyone.
      </h2>
      <p className={STATEMENT_CLASS}>Some of them want to break it.</p>
      <div>
        <Resolution />
        <StepGrid className="mt-12" />
      </div>
    </div>
  );
}
