import { Switch } from "@/components/ui/field";

export interface SyncRowProps {
  title: string;
  body: string;
  checked: boolean;
  disabled?: boolean;
  locked?: boolean; // not included in the plan: shown off and not switchable
  onChange: (checked: boolean) => void;
}

export function SyncRow({ title, body, checked, disabled, locked, onChange }: SyncRowProps) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 first:pt-0">
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {title} {disabled && <span className="text-xs font-normal text-muted-foreground">(required)</span>}
          {locked && <span className="text-xs font-normal text-muted-foreground">(Pro)</span>}
        </p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <Switch label={title} checked={checked} disabled={disabled || locked} onCheckedChange={onChange} />
    </div>
  );
}
