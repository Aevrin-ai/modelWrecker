import { Resolution } from "./resolution";
import { StepGrid } from "./step-grid";

// below lg only the final frame shows, still; the first two lines stay for a screen reader
export function FinalFrame() {
  return (
    <div className="max-w-container mx-auto flex min-h-svh flex-col justify-center py-24">
      <p className="sr-only">Your AI talks to everyone. Some of them want to break it.</p>
      <Resolution heading="h2" id="story-heading" compact />
      <StepGrid className="mt-10" />
    </div>
  );
}
