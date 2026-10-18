import { Button } from "@/components/ui/button";

export interface FormActionsProps {
  isBusy: boolean;
  submitLabel: string;
  onClose: () => void;
}

export function FormActions({ isBusy, submitLabel, onClose }: FormActionsProps) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
        Cancel
      </Button>
      <Button type="submit" disabled={isBusy}>
        {submitLabel}
      </Button>
    </div>
  );
}
