import { useState } from "react";
import { Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GateFrame } from "./GateFrame";

export interface RecoveryCodesProps {
  codes: string[];
  onDone: () => void;
}

export function RecoveryCodes({ codes, onDone }: RecoveryCodesProps) {
  const [saved, setSaved] = useState(false);
  return (
    <GateFrame title="Save your recovery codes" icon={<KeyRound className="size-5" />}>
      <p className="text-sm text-muted-foreground">
        If you lose your phone, each of these codes signs you in once. They are shown only now. Keep them in your password manager.
      </p>
      <ol className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ol>
      <Button variant="outline" className="w-full" onClick={() => void navigator.clipboard?.writeText(codes.join("\n"))}>
        <Copy /> Copy all
      </Button>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I saved these codes
      </label>
      <Button className="w-full" disabled={!saved} onClick={onDone}>
        Open the admin console
      </Button>
    </GateFrame>
  );
}
