export interface StepNumberProps {
  step: number;
}

export function StepNumber({ step }: StepNumberProps) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-primary text-sm font-semibold text-primary-foreground">
      {step}
    </span>
  );
}
