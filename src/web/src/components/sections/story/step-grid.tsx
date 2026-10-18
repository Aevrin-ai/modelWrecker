import { cn } from "@/lib/utils";
import { STEPS, type Step } from "./steps";

function StepChip({ step }: { step: Step }) {
  const Icon = step.icon;
  return (
    <div className="bg-card border-border flex items-center gap-2.5 rounded-xl border px-3 py-2.5">
      <Icon aria-hidden="true" className="text-brand size-4 shrink-0" />
      <span className="text-foreground text-[15px] leading-tight">{step.label}</span>
    </div>
  );
}

export interface StepGridProps {
  className?: string;
}

// the nine steps of a run, in order, for screens without room for the ring
export function StepGrid({ className }: StepGridProps) {
  return (
    <ol aria-label="The steps of a run" className={cn("mx-auto grid w-full max-w-md grid-cols-2 gap-2", className)}>
      {STEPS.map((step) => (
        <li key={step.id}>
          <StepChip step={step} />
        </li>
      ))}
    </ol>
  );
}
