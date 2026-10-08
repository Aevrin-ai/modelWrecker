/*
  Management dialogs. Each one collects METADATA and calls the api layer. None of them
  contacts a target, runs an attack, or reaches the network on its own. Validation here
  is a convenience; the control plane validates again on the server.
*/

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { z } from "zod";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox, Field, Textarea } from "@/components/ui/field";
import { RunsLocallyChip } from "@/components/LocalBoundary";
import { apiClient } from "@/api";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useToast } from "@/hooks/useToast";
import { STOP_CONDITION_LABEL, STRATEGIES, TARGET_TYPE_DESCRIPTION, TARGET_TYPE_LABEL, TARGET_TYPES } from "@/lib/constants";
import type { Campaign, Project, Target, TargetType } from "@/types";

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Try again.";
}

// --- confirm ---------------------------------------------------------------------------

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={go} disabled={busy}>
            {busy ? "Working..." : confirmLabel}
          </Button>
        </>
      }
    >
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </Dialog>
  );
}

// --- rename (generic) ------------------------------------------------------------------

export function RenameDialog({
  open,
  onClose,
  title,
  initial,
  label = "Name",
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  initial: string;
  label?: string;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setName(initial);
      setError(null);
    }
  }, [open, initial]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = z.string().trim().min(2, "Use at least 2 characters.").max(80, "Keep it under 80 characters.").safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      await onSave(parsed.data);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form id="rename-form" onSubmit={submit} className="space-y-4 pb-4">
        <Field label={label} htmlFor="rename-input" error={error}>
          <Input id="rename-input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// --- project ---------------------------------------------------------------------------

const projectSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(80, "Keep it under 80 characters."),
  description: z.string().trim().max(400, "Keep it under 400 characters."),
});

export function ProjectDialog({
  open,
  onClose,
  project,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** When set, edits this project; otherwise creates a new one. */
  project?: Project | null;
  onSaved?: (p: Project) => void;
}) {
  const { refreshProjects } = useActiveProject();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setErrors({});
    }
  }, [open, project]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = projectSchema.safeParse({ name, description });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setBusy(true);
    try {
      const saved = project
        ? await apiClient.updateProject(project.id, parsed.data)
        : await apiClient.createProject(parsed.data);
      refreshProjects();
      toast({ title: project ? "Project updated" : "Project created", description: saved.name });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={project ? "Edit project" : "New project"}
      description="A project groups the targets, campaigns, devices, and findings for one system under test."
    >
      <form onSubmit={submit} className="space-y-4 pb-4">
        <Field label="Project name" htmlFor="project-name" error={errors.name}>
          <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme AI Assistant" />
        </Field>
        <Field label="Description" htmlFor="project-desc" error={errors.description} hint="Optional. What system does this project test?">
          <Textarea id="project-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {errors.form && <p className="text-sm font-medium text-destructive">{errors.form}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving..." : project ? "Save changes" : "Create project"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// --- target ----------------------------------------------------------------------------

const targetSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(80),
  type: z.enum(TARGET_TYPES),
  provider: z.string().trim().min(1, "Name the provider, e.g. OpenAI or Local (Ollama)."),
  endpoint: z
    .string()
    .trim()
    .min(1, "Enter the endpoint host or path.")
    .refine((v) => !/[?&](api[_-]?key|token|key)=/i.test(v), "Do not put keys in the endpoint. Keys stay in the local engine's environment."),
  model: z.string().trim().min(1, "Enter the model name."),
  projectId: z.string().min(1, "Pick a project."),
  authorized: z.literal(true, { errorMap: () => ({ message: "You must confirm you are authorized to test this system." }) }),
});

export function TargetDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (t: Target) => void;
}) {
  const { projects, activeProjectId } = useActiveProject();
  const { toast } = useToast();
  const liveProjects = projects.filter((p) => !p.archived);
  const [form, setForm] = useState({
    name: "",
    type: "chat" as TargetType,
    provider: "",
    endpoint: "",
    model: "",
    projectId: "",
    authorized: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        name: "",
        type: "chat",
        provider: "",
        endpoint: "",
        model: "",
        projectId: activeProjectId ?? liveProjects[0]?.id ?? "",
        authorized: false,
      });
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = targetSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setBusy(true);
    try {
      const t = await apiClient.createTarget(parsed.data);
      toast({ title: "Target registered", description: `${t.name} is ready for campaigns.` });
      onSaved?.(t);
      onClose();
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Register target"
      description="Record the AI system you are allowed to test. The dashboard stores this metadata only; it never connects to the target."
      className="max-w-xl"
    >
      <form onSubmit={submit} className="space-y-4 pb-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Target name" htmlFor="t-name" error={errors.name} className="sm:col-span-2">
            <Input id="t-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Production Support Chat" />
          </Field>
          <Field label="Target type" htmlFor="t-type" hint={TARGET_TYPE_DESCRIPTION[form.type]}>
            <Select id="t-type" value={form.type} onChange={(e) => set("type", e.target.value as TargetType)} className="w-full">
              {TARGET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TARGET_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Project" htmlFor="t-project" error={errors.projectId}>
            <Select id="t-project" value={form.projectId} onChange={(e) => set("projectId", e.target.value)} className="w-full">
              {liveProjects.length === 0 && <option value="">No projects yet</option>}
              {liveProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Provider" htmlFor="t-provider" error={errors.provider}>
            <Input id="t-provider" value={form.provider} onChange={(e) => set("provider", e.target.value)} placeholder="OpenAI-compatible" />
          </Field>
          <Field label="Model" htmlFor="t-model" error={errors.model}>
            <Input id="t-model" value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="llama3" />
          </Field>
          <Field
            label="Endpoint"
            htmlFor="t-endpoint"
            error={errors.endpoint}
            hint="Host or path only. API keys stay in the local engine's environment, never here."
            className="sm:col-span-2"
          >
            <Input id="t-endpoint" value={form.endpoint} onChange={(e) => set("endpoint", e.target.value)} placeholder="localhost:11434" />
          </Field>
        </div>
        <div className="rounded-md border p-4">
          <label htmlFor="t-auth" className="flex items-start gap-3 text-sm">
            <Checkbox id="t-auth" checked={form.authorized} onChange={(v) => set("authorized", v)} />
            <span>
              <span className="font-medium">I am authorized to test this system.</span>
              <span className="block text-muted-foreground">
                This sets <code className="font-mono text-xs">authorized: true</code> in the target config. The engine refuses
                any target that is not marked authorized.
              </span>
            </span>
          </label>
          {errors.authorized && <p className="mt-2 text-xs font-medium text-destructive">{errors.authorized}</p>}
        </div>
        {errors.form && <p className="text-sm font-medium text-destructive">{errors.form}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Registering..." : "Register target"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// --- campaign --------------------------------------------------------------------------

const campaignSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(80),
  projectId: z.string().min(1, "Pick a project."),
  targetId: z.string().min(1, "Pick a target."),
  strategies: z.array(z.string()).min(1, "Pick at least one strategy."),
  objectiveCount: z.number().int().min(1, "At least 1 objective.").max(500),
  stopCondition: z.enum(["complete", "first_finding", "budget"]),
  concurrency: z.number().int().min(1).max(32),
  maxAttempts: z.number().int().min(1).max(100000).nullable(),
});

export function CampaignDialog({
  open,
  onClose,
  targets,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  targets: Target[];
  onSaved?: (c: Campaign) => void;
}) {
  const { projects, activeProjectId } = useActiveProject();
  const { toast } = useToast();
  const liveProjects = projects.filter((p) => !p.archived);
  const [form, setForm] = useState({
    name: "",
    projectId: "",
    targetId: "",
    strategies: [] as string[],
    objectiveCount: 6,
    stopCondition: "complete" as Campaign["stopCondition"],
    concurrency: 2,
    maxAttempts: 300 as number | null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      const projectId = activeProjectId ?? liveProjects[0]?.id ?? "";
      const firstTarget = targets.find((t) => t.projectId === projectId);
      setForm({
        name: "",
        projectId,
        targetId: firstTarget?.id ?? "",
        strategies: [],
        objectiveCount: 6,
        stopCondition: "complete",
        concurrency: 2,
        maxAttempts: 300,
      });
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const projectTargets = useMemo(() => targets.filter((t) => t.projectId === form.projectId), [targets, form.projectId]);
  const target = targets.find((t) => t.id === form.targetId);
  const available = STRATEGIES.filter((s) => !target || s.targets.includes(target.type));

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  function toggleStrategy(id: string, on: boolean) {
    set("strategies", on ? [...form.strategies, id] : form.strategies.filter((s) => s !== id));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = campaignSchema.safeParse({
      ...form,
      strategies: form.strategies.filter((s) => available.some((a) => a.id === s)),
    });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setBusy(true);
    try {
      const c = await apiClient.createCampaign(parsed.data);
      toast({ title: "Campaign saved as draft", description: "Mark it ready when you want your local engine to run it." });
      onSaved?.(c);
      onClose();
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New campaign"
      description="Configure a campaign. It is saved as a draft; nothing runs until your local engine picks it up."
      className="max-w-2xl"
    >
      <form onSubmit={submit} className="space-y-4 pb-4">
        <RunsLocallyChip />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Campaign name" htmlFor="c-name" error={errors.name} className="sm:col-span-2">
            <Input id="c-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Weekly jailbreak regression" />
          </Field>
          <Field label="Project" htmlFor="c-project" error={errors.projectId}>
            <Select
              id="c-project"
              value={form.projectId}
              onChange={(e) => {
                const pid = e.target.value;
                setForm((f) => ({ ...f, projectId: pid, targetId: targets.find((t) => t.projectId === pid)?.id ?? "" }));
              }}
              className="w-full"
            >
              {liveProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Target" htmlFor="c-target" error={errors.targetId} hint={target && !target.authorized ? "This target is not authorized yet; it cannot be marked ready." : undefined}>
            <Select id="c-target" value={form.targetId} onChange={(e) => set("targetId", e.target.value)} className="w-full">
              {projectTargets.length === 0 && <option value="">No targets in this project</option>}
              {projectTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({TARGET_TYPE_LABEL[t.type]})
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Strategies</legend>
          <p className="text-xs text-muted-foreground">Only strategies that fit the target type are shown. Advanced ones need the matching plan entitlement.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {available.map((s) => (
              <label key={s.id} htmlFor={`s-${s.id}`} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                <Checkbox id={`s-${s.id}`} checked={form.strategies.includes(s.id)} onChange={(v) => toggleStrategy(s.id, v)} />
                <span className="font-mono text-xs">{s.id}</span>
                {s.advanced && <span className="ml-auto text-[0.65rem] uppercase tracking-wide text-muted-foreground">Advanced</span>}
              </label>
            ))}
          </div>
          {errors.strategies && <p className="text-xs font-medium text-destructive">{errors.strategies}</p>}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Objectives" htmlFor="c-obj" error={errors.objectiveCount}>
            <Input id="c-obj" type="number" min={1} value={form.objectiveCount} onChange={(e) => set("objectiveCount", Number(e.target.value))} />
          </Field>
          <Field label="Stop condition" htmlFor="c-stop">
            <Select id="c-stop" value={form.stopCondition} onChange={(e) => set("stopCondition", e.target.value as Campaign["stopCondition"])} className="w-full">
              {(Object.keys(STOP_CONDITION_LABEL) as Campaign["stopCondition"][]).map((k) => (
                <option key={k} value={k}>
                  {STOP_CONDITION_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Concurrency" htmlFor="c-conc" error={errors.concurrency} hint="Objectives run in parallel on the engine.">
            <Input id="c-conc" type="number" min={1} max={32} value={form.concurrency} onChange={(e) => set("concurrency", Number(e.target.value))} />
          </Field>
          <Field label="Max attempts" htmlFor="c-max" error={errors.maxAttempts} hint="Attack budget. Leave empty for no attempt cap.">
            <Input
              id="c-max"
              type="number"
              min={1}
              value={form.maxAttempts ?? ""}
              onChange={(e) => set("maxAttempts", e.target.value === "" ? null : Number(e.target.value))}
            />
          </Field>
        </div>
        {errors.form && <p className="text-sm font-medium text-destructive">{errors.form}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving..." : "Save as draft"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
