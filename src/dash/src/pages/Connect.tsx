import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { CommandBlock } from "@/components/CommandBlock";
import { CloudLocalDiagram, ControlPlaneCallout } from "@/components/LocalBoundary";
import { EngineStatusCard } from "@/components/EngineStatus";
import { LogoTile } from "@/components/Logo";
import { ApiError, apiClient } from "@/api";
import { useActiveProject } from "@/hooks/useActiveProject";

// Every command below is copied from docs/deployment/docker.md and
// docs/reference/CLI.md. The dashboard only shows them; it never runs anything.
// The last step (device linking) is the approval half of the OAuth 2.0 device flow in
// docs/architecture/control-plane-api.md: the engine shows a code, the user approves it here.
const STEPS: {
  title: string;
  body: string;
  commands?: { label?: string; command: string }[];
}[] = [
  {
    title: "Install Docker",
    body: "Install Docker Desktop (macOS, Windows) or Docker Engine with the compose plugin (Linux). The engine image runs as a non-root user with a read-only root filesystem.",
  },
  {
    title: "Get the ModelWrecker engine",
    body: "Clone the repository and create your local environment file. Provider keys stay in .env on your machine; they never reach Aevrin.",
    commands: [
      { command: "git clone https://github.com/spacesdrive/modelWrecker.git && cd modelWrecker" },
      { label: "then set the provider key your config names", command: "cp .env.example .env" },
    ],
  },
  {
    title: "Add a campaign config",
    body: "Campaign YAML is mounted read-only into the container. Start from an example and point it at a target you are authorized to test.",
    commands: [{ command: "mkdir config runs" }, { command: "cp examples/openrouter.yaml config/campaign.yaml" }],
  },
  {
    title: "Build and check the engine",
    body: "Build the image once, then validate the config. Validation also checks that the target is marked as authorized.",
    commands: [
      { command: "docker compose build" },
      { command: "docker compose run --rm modelwrecker validate /config/campaign.yaml" },
    ],
  },
  {
    title: "Run a campaign locally",
    body: "All attacks, model calls, and judging run inside the container on your machine. Results land in ./runs.",
    commands: [
      { command: "docker compose run --rm modelwrecker run /config/campaign.yaml" },
      { label: "build the ASR report and leaderboard", command: "docker compose run --rm modelwrecker analyze /work/runs/<run-id>" },
    ],
  },
];

/** A device user code: 8 characters shown as XXXX-XXXX. */
const USER_CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** Uppercase, keep letters and digits only, and put the dash after the fourth character. */
function formatUserCode(raw: string): string {
  const chars = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return chars.length > 4 ? `${chars.slice(0, 4)}-${chars.slice(4)}` : chars;
}

/** Clear text for the device-approval error codes in the contract; otherwise the API's safe message. */
function approvalErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "unknown_code") return "That code was not recognized. Check the code your engine shows and try again.";
    if (err.code === "expired_token") return "This code has expired. Run modelwrecker login again for a new one.";
    if (err.code === "already_used") return "This code was already used. Run modelwrecker login again for a new one.";
    return err.message;
  }
  return err instanceof Error && err.message ? err.message : "The approval did not go through. Try again.";
}

type LinkState =
  | { kind: "idle" }
  | { kind: "busy"; approve: boolean }
  | { kind: "approved" }
  | { kind: "denied" }
  | { kind: "error"; message: string };

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-primary text-sm font-semibold text-primary-foreground">
      {n}
    </span>
  );
}

/** The last step: approve or deny a `modelwrecker login` request by its user code. */
function LinkDeviceStep({ n }: { n: number }) {
  const [params, setParams] = useSearchParams();
  const { projects, activeProjectId } = useActiveProject();
  const [code, setCode] = useState(() => formatUserCode(params.get("code") ?? ""));
  const [projectId, setProjectId] = useState<string>(activeProjectId ?? "");
  const [touchedProject, setTouchedProject] = useState(false);
  const [state, setState] = useState<LinkState>({ kind: "idle" });

  const openProjects = projects.filter((p) => !p.archived);
  const valid = USER_CODE_RE.test(code);
  const busy = state.kind === "busy";

  // Follow the header project switcher until the user picks a project here.
  useEffect(() => {
    if (!touchedProject) setProjectId(activeProjectId ?? "");
  }, [activeProjectId, touchedProject]);

  async function submit(approve: boolean) {
    if (!valid || busy) return;
    setState({ kind: "busy", approve });
    try {
      const res = await apiClient.approveDevice(code, projectId || null, approve);
      setState(res.denied ? { kind: "denied" } : { kind: "approved" });
      // A used code must not be prefilled again on reload.
      if (params.has("code")) {
        const next = new URLSearchParams(params);
        next.delete("code");
        setParams(next, { replace: true });
      }
    } catch (err) {
      setState({ kind: "error", message: approvalErrorText(err) });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit(true);
  }

  function reset() {
    setCode("");
    setState({ kind: "idle" });
  }

  return (
    <Card id="link-device">
      <CardContent className="flex gap-4 p-6">
        <StepNumber n={n} />
        <div className="min-w-0 flex-1 space-y-3">
          <p className="font-semibold">Link the device to this workspace</p>
          <p className="text-sm text-muted-foreground">
            Sign the engine in. It shows a short code; approve that code here. The engine then gets a scoped,
            revocable device token (never your Google token) so it can sync summarized results. Until you link
            it, the engine works fully offline.
          </p>
          <CommandBlock command="modelwrecker login" label="on the machine that runs the engine" />

          {state.kind === "approved" ? (
            <div role="status" className="space-y-3 rounded-md border p-4">
              <p className="flex items-start gap-2 text-sm font-medium">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                Approved. Your engine will finish signing in within a few seconds.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link to="/devices" className={buttonClasses("default", "sm")}>
                  View devices
                </Link>
                <Button variant="outline" size="sm" onClick={reset}>
                  Link another device
                </Button>
              </div>
            </div>
          ) : state.kind === "denied" ? (
            <div role="status" className="space-y-3 rounded-md border p-4">
              <p className="flex items-start gap-2 text-sm font-medium">
                <XCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                Denied. That engine will not get a token. Run modelwrecker login again if this was a mistake.
              </p>
              <Button variant="outline" size="sm" onClick={reset}>
                Enter another code
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4 rounded-md border p-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Code from your engine"
                  htmlFor="device-code"
                  hint="Only approve a code you started yourself. It must match your terminal."
                >
                  <Input
                    id="device-code"
                    value={code}
                    onChange={(e) => {
                      setCode(formatUserCode(e.target.value));
                      if (state.kind === "error") setState({ kind: "idle" });
                    }}
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
                  {/* A grid cell stretches the select's inline wrapper to the full column width. */}
                  <div className="grid">
                    <Select
                      id="device-project"
                      value={projectId}
                      onChange={(e) => {
                        setTouchedProject(true);
                        setProjectId(e.target.value);
                      }}
                      className="w-full"
                      disabled={busy}
                    >
                      <option value="">No project</option>
                      {openProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
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
                  {busy && state.approve ? <Loader2 className="animate-spin" /> : <Check />}
                  Approve
                </Button>
                <Button type="button" variant="outline" disabled={!valid || busy} onClick={() => void submit(false)}>
                  {busy && !state.approve ? <Loader2 className="animate-spin" /> : <XCircle />}
                  Deny
                </Button>
              </div>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function Connect() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Connect ModelWrecker"
        description="Run the engine on your own machine. The dashboard manages and shows results; it never runs attacks."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {STEPS.map((s, i) => (
            <Card key={s.title}>
              <CardContent className="flex gap-4 p-6">
                <StepNumber n={i + 1} />
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                  {s.commands?.map((c) => (
                    <CommandBlock key={c.command} command={c.command} label={c.label} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          <LinkDeviceStep n={STEPS.length + 1} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <LogoTile />
              <div>
                <CardTitle>ModelWrecker engine</CardTitle>
                <CardDescription>The compute plane, on your machine</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                "Non-root container, read-only root filesystem",
                "No Docker socket, SSH keys, or home folder mounted",
                "Only ./config (read-only) and ./runs are shared",
                "CPU, memory, and process limits set in compose",
              ].map((t) => (
                <p key={t} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0" /> {t}
                </p>
              ))}
            </CardContent>
          </Card>
          <EngineStatusCard />
          <ControlPlaneCallout />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What stays where</CardTitle>
          <CardDescription>Detailed evidence and transcripts stay local unless you turn on syncing in Settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <CloudLocalDiagram />
        </CardContent>
      </Card>
    </div>
  );
}
