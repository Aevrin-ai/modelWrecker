import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { CommandBlock } from "@/components/CommandBlock";
import { apiClient } from "@/api";
import { useActiveProject } from "@/hooks/useActiveProject";
import { approvalErrorText, formatUserCode, USER_CODE_RE, type LinkState } from "./deviceCode";
import { DeviceCodeForm } from "./DeviceCodeForm";
import { LinkApproved } from "./LinkApproved";
import { LinkDenied } from "./LinkDenied";
import { StepNumber } from "./StepNumber";

export interface LinkDeviceStepProps {
  step: number;
}

// approves or denies a `modelwrecker login` request by its user code (the OAuth 2.0 device flow)
export function LinkDeviceStep({ step }: LinkDeviceStepProps) {
  const [params, setParams] = useSearchParams();
  const { projects, activeProjectId } = useActiveProject();
  const [code, setCode] = useState(() => formatUserCode(params.get("code") ?? ""));
  const [projectId, setProjectId] = useState<string>(activeProjectId ?? "");
  const [touchedProject, setTouchedProject] = useState(false);
  const [state, setState] = useState<LinkState>({ kind: "idle" });

  const openProjects = projects.filter((project) => !project.archived);
  const valid = USER_CODE_RE.test(code);
  const busy = state.kind === "busy";

  // follow the header project switcher until the user picks a project here
  useEffect(() => {
    if (!touchedProject) setProjectId(activeProjectId ?? "");
  }, [activeProjectId, touchedProject]);

  async function submit(approve: boolean) {
    if (!valid || busy) return;
    setState({ kind: "busy", approve });
    try {
      const result = await apiClient.approveDevice(code, projectId || null, approve);
      setState(result.denied ? { kind: "denied" } : { kind: "approved" });
      // a used code must not be prefilled again on reload
      if (params.has("code")) {
        const next = new URLSearchParams(params);
        next.delete("code");
        setParams(next, { replace: true });
      }
    } catch (err) {
      setState({ kind: "error", message: approvalErrorText(err) });
    }
  }

  function handleCodeChange(value: string) {
    setCode(formatUserCode(value));
    if (state.kind === "error") setState({ kind: "idle" });
  }

  function handleProjectChange(value: string) {
    setTouchedProject(true);
    setProjectId(value);
  }

  function reset() {
    setCode("");
    setState({ kind: "idle" });
  }

  let panel: ReactNode;
  if (state.kind === "approved") panel = <LinkApproved onReset={reset} />;
  else if (state.kind === "denied") panel = <LinkDenied onReset={reset} />;
  else {
    panel = (
      <DeviceCodeForm
        code={code}
        projectId={projectId}
        openProjects={openProjects}
        state={state}
        valid={valid}
        busy={busy}
        onCodeChange={handleCodeChange}
        onProjectChange={handleProjectChange}
        onDecide={(approve) => void submit(approve)}
      />
    );
  }

  return (
    <Card id="link-device">
      <CardContent className="flex gap-4 p-6">
        <StepNumber step={step} />
        <div className="min-w-0 flex-1 space-y-3">
          <p className="font-semibold">Link the device to this workspace</p>
          <p className="text-sm text-muted-foreground">
            Sign the engine in. It shows a short code; approve that code here. The engine then gets a scoped,
            revocable device token (never your Google token) so it can sync summarized results. Until you link
            it, the engine works fully offline.
          </p>
          <CommandBlock command="modelwrecker login" label="on the machine that runs the engine" />

          {panel}
        </div>
      </CardContent>
    </Card>
  );
}
