import type { FormEvent } from "react";
import { AlertTriangle, Check, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import type { Project } from "@/types";
import type { LinkState } from "./deviceCode";

export interface DeviceCodeFormProps {
  code: string;
  projectId: string;
  openProjects: Project[];
  state: LinkState;
  valid: boolean;
  busy: boolean;
  onCodeChange: (value: string) => void;
  onProjectChange: (projectId: string) => void;
  onDecide: (approve: boolean) => void;
}

export function DeviceCodeForm({ code, projectId, openProjects, state, valid, busy, onCodeChange, onProjectChange, onDecide }: DeviceCodeFormProps) {
  const isApproving = state.kind === "busy" && state.approve;
  const isDenying = state.kind === "busy" && !state.approve;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onDecide(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border p-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Code from your engine"
          htmlFor="device-code"
          hint="Only approve a code you started yourself. It must match your terminal."
        >
          <Input
            id="device-code"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder="WDJB-MJHT"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={9}
            aria-invalid={code.length > 0 && !valid}
            className="font-mono uppercase tracking-widest"
            disabled={busy}
          />
        </Field>
        <Field label="Project" htmlFor="device-project" hint="Synced results land in this project.">
          {/* a grid cell stretches the select's inline wrapper to the full column width */}
          <div className="grid">
            <Select
              id="device-project"
              value={projectId}
              onChange={(e) => onProjectChange(e.target.value)}
              className="w-full"
              disabled={busy}
            >
              <option value="">No project</option>
              {openProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>
        </Field>
      </div>

      {state.kind === "error" && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!valid || busy}>
          {isApproving ? <Loader2 className="animate-spin" /> : <Check />}
          Approve
        </Button>
        <Button type="button" variant="outline" disabled={!valid || busy} onClick={() => onDecide(false)}>
          {isDenying ? <Loader2 className="animate-spin" /> : <XCircle />}
          Deny
        </Button>
      </div>
    </form>
  );
}
