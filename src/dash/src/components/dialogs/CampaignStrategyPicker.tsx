import { Checkbox } from "@/components/ui/field";
import type { STRATEGIES } from "@/lib/constants";

export interface CampaignStrategyPickerProps {
  available: typeof STRATEGIES;
  selected: string[];
  error?: string;
  onToggle: (strategyId: string, isOn: boolean) => void;
}

export function CampaignStrategyPicker({ available, selected, error, onToggle }: CampaignStrategyPickerProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Strategies</legend>
      <p className="text-xs text-muted-foreground">Only strategies that fit the target type are shown. Advanced ones need the matching plan entitlement.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {available.map((strategy) => (
          <label key={strategy.id} htmlFor={`s-${strategy.id}`} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
            <Checkbox id={`s-${strategy.id}`} checked={selected.includes(strategy.id)} onChange={(isOn) => onToggle(strategy.id, isOn)} />
            <span className="font-mono text-xs">{strategy.id}</span>
            {strategy.advanced && <span className="ml-auto text-[0.65rem] uppercase tracking-wide text-muted-foreground">Advanced</span>}
          </label>
        ))}
      </div>
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </fieldset>
  );
}
