import { Checkbox } from "@/components/ui/field";

export interface TargetAuthorizationFieldProps {
  isAuthorized: boolean;
  error?: string;
  onChange: (isAuthorized: boolean) => void;
}

export function TargetAuthorizationField({ isAuthorized, error, onChange }: TargetAuthorizationFieldProps) {
  return (
    <div className="rounded-md border p-4">
      <label htmlFor="t-auth" className="flex items-start gap-3 text-sm">
        <Checkbox id="t-auth" checked={isAuthorized} onChange={onChange} />
        <span>
          <span className="font-medium">I am authorized to test this system.</span>
          <span className="block text-muted-foreground">
            This sets <code className="font-mono text-xs">authorized: true</code> in the target config. The engine refuses
            any target that is not marked authorized.
          </span>
        </span>
      </label>
      {error && <p className="mt-2 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
