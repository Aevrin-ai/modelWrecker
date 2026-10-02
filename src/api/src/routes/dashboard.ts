// Dashboard routes. Every query runs as the signed-in user (Postgres RLS) AND filters by owner_id, so
// one account can never read or change another account's rows. Responses use the dashboard's types
// (src/dash/src/types/index.ts). Nothing here contacts a target, a model, or any other URL.
import type { Context, Hono, MiddlewareHandler } from "hono";
import type { AppEnv } from "../app";
import { parseBody as parse } from "../body";
import type { Db, Deps, Row } from "../db";
import { ApiError, displayEndpoint, wilson } from "../lib";
import { PLANS, planById } from "../plans";
import {
  CampaignCreate,
  FindingPatch,
  NamePatch,
  ProjectCreate,
  ProjectPatch,
  SEVERITIES,
  SettingsPatch,
  TargetCreate,
} from "../schemas";

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const str = (v: unknown) => (v == null ? "" : String(v));
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
const iso = (v: unknown) => (v == null ? null : String(v));
const day = (v: unknown) => str(v).slice(0, 10);
const emptySeverity = () => ({ critical: 0, high: 0, medium: 0, low: 0, info: 0 }) as Record<string, number>;

interface World {
  projects: Row[];
  targets: Row[];
  campaigns: Row[];
  runs: Row[];
  findings: Row[];
  devices: Row[];
}

async function loadWorld(db: Db, owner: string): Promise<World> {
  const all = (t: string) => db.table(t).select({ eq: { owner_id: owner } });
  const [projects, targets, campaigns, runs, findings, devices] = await Promise.all([
    all("projects"),
    all("targets"),
    all("campaigns"),
    all("runs"),
    all("findings"),
    all("devices"),
  ]);
  return { projects, targets, campaigns, runs, findings, devices: devices.filter((d) => !d.revoked) };
}

const byId = (rows: Row[]) => new Map(rows.map((r) => [str(r.id), r]));

function scope(w: World, projectId?: string): World {
  if (!projectId) return w;
  const campaigns = w.campaigns.filter((c) => str(c.project_id) === projectId);
  const campaignIds = new Set(campaigns.map((c) => str(c.id)));
  return {
    projects: w.projects.filter((p) => str(p.id) === projectId),
    targets: w.targets.filter((t) => str(t.project_id) === projectId),
    campaigns,
    runs: w.runs.filter((r) => campaignIds.has(str(r.campaign_id))),
    findings: w.findings.filter((f) => str(f.project_id) === projectId),
    devices: w.devices.filter((d) => str(d.project_id) === projectId),
  };
}

// --- mappers: database rows -> dashboard types --------------------------------------------------

function mapProject(p: Row, w: World) {
  const id = str(p.id);
  const s = scope(w, id);
  const risk = emptySeverity();
  for (const f of s.findings) if (f.status !== "fixed" && f.status !== "accepted-risk") risk[str(f.severity)] += 1;
  const activity = [...s.runs.map((r) => str(r.completed_at ?? r.created_at)), ...s.campaigns.map((c) => str(c.created_at))]
    .filter(Boolean)
    .sort()
    .pop();
  return {
    id,
    name: str(p.name),
    description: str(p.description),
    archived: Boolean(p.archived),
    createdAt: str(p.created_at),
    lastActivityAt: activity ?? null,
    counts: {
      targets: s.targets.length,
      campaigns: s.campaigns.length,
      findings: s.findings.length,
      devices: s.devices.length,
    },
    riskSummary: risk,
  };
}

function lastRunFor(w: World, campaignIds: Set<string>) {
  return w.runs
    .filter((r) => campaignIds.has(str(r.campaign_id)))
    .map((r) => str(r.completed_at ?? r.created_at))
    .sort()
    .pop();
}

function mapTarget(t: Row, w: World, now: Date) {
  const id = str(t.id);
  const campaigns = w.campaigns.filter((c) => str(c.target_id) === id);
  const lastTested = lastRunFor(w, new Set(campaigns.map((c) => str(c.id)))) ?? null;
  const findings = w.findings.filter((f) => str(f.target_id) === id);
  const top = [...SEVERITIES].reverse().find((s) => findings.some((f) => f.severity === s)) ?? null;
  const recent = lastTested && now.getTime() - new Date(lastTested).getTime() < 7 * DAY_MS;
  return {
    id,
    name: str(t.name),
    type: str(t.type) || "chat",
    provider: str(t.provider),
    endpoint: str(t.endpoint),
    model: str(t.model),
    status: !t.authorized ? "error" : recent ? "active" : lastTested ? "idle" : "ready",
    projectId: str(t.project_id),
    projectName: str(byId(w.projects).get(str(t.project_id))?.name),
    authorized: Boolean(t.authorized),
    capabilities: [],
    lastTestedAt: lastTested,
    campaignCount: campaigns.length,
    topSeverity: top,
    createdAt: str(t.created_at),
  };
}

function campaignTotals(c: Row, w: World) {
  const runs = w.runs.filter((r) => str(r.campaign_id) === str(c.id));
  const attempts = runs.reduce((a, r) => a + num(r.attempts), 0);
  const successes = runs.reduce((a, r) => a + num(r.successful_attacks), 0);
  return { runs, attempts, successes };
}

function mapCampaign(c: Row, w: World) {
  const { attempts, successes } = campaignTotals(c, w);
  const started = iso(c.started_at);
  const completed = iso(c.completed_at);
  const duration = started && completed ? Math.max(0, Math.round((Date.parse(completed) - Date.parse(started)) / 1000)) : null;
  const target = byId(w.targets).get(str(c.target_id));
  const device = byId(w.devices).get(str(c.device_id));
  return {
    id: str(c.id),
    name: str(c.name),
    status: str(c.status) || "draft",
    projectId: str(c.project_id),
    projectName: str(byId(w.projects).get(str(c.project_id))?.name),
    targetId: str(c.target_id),
    targetName: str(target?.name),
    deviceId: c.device_id ? str(c.device_id) : null,
    deviceName: device ? str(device.name) : null,
    objectiveCount: num(c.objective_count),
    strategies: (c.strategies as string[] | null) ?? [],
    stopCondition: str(c.stop_condition) || "complete",
    concurrency: num(c.concurrency) || 1,
    budget: { maxAttempts: c.max_attempts == null ? null : num(c.max_attempts), maxTokens: null, maxSeconds: null, maxObjectives: null },
    startedAt: started,
    completedAt: completed,
    durationSeconds: duration,
    attemptCount: attempts,
    successfulAttacks: successes,
    findingCount: w.findings.filter((f) => str(f.campaign_id) === str(c.id)).length,
    successRate: attempts ? successes / attempts : 0,
    createdAt: str(c.created_at),
  };
}

function mapFinding(f: Row, w: World) {
  const target = byId(w.targets).get(str(f.target_id));
  const campaign = byId(w.campaigns).get(str(f.campaign_id));
  const run = byId(w.runs).get(str(f.run_id));
  const taxonomy = str(f.taxonomy)
    .split(",")
    .filter(Boolean)
    .map((t) => {
      const [framework, ...rest] = t.split(":");
      return { framework, id: rest.join(":") };
    });
  const replays = num(f.replays);
  const successes = num(f.successes);
  return {
    id: str(f.id),
    title: str(f.title),
    summary: "",
    severity: str(f.severity),
    status: str(f.status) || "open",
    outcome: "success",
    score: num(f.score),
    projectId: str(f.project_id),
    projectName: str(byId(w.projects).get(str(f.project_id))?.name),
    targetId: str(f.target_id),
    targetName: str(target?.name),
    targetType: str(target?.type) || "chat",
    campaignId: str(f.campaign_id),
    campaignName: str(campaign?.name),
    strategy: str(f.technique),
    model: str(run?.model),
    provider: str(run?.provider),
    taxonomy,
    reliability: {
      attemptsRun: replays,
      successes,
      partials: 0,
      successRate: num(f.success_rate),
      ciLow: num(f.confidence_low),
      ciHigh: num(f.confidence_high),
      highVariance: false,
      confidence: str(f.confidence) || "does_not_hold",
      backendPinned: false,
    },
    signals: [],
    // Metadata only in lists. The finding detail route adds the evidence when it was synced.
    evidence: { synced: Boolean(f.evidence_synced) },
    relatedFindingIds: [],
    discoveredAt: str(f.discovered_at ?? f.created_at),
    lastSeenAt: str(f.last_seen_at ?? f.created_at),
  };
}

type Detail = {
  objective?: { title?: string; category?: string; success_criteria?: string };
  strategy?: string;
  transforms?: string[];
  payload?: string;
  response?: string;
  reasoning?: string;
  tool_calls?: { name: string; args: string }[];
  judge?: {
    outcome?: string;
    score?: number;
    rationale?: string;
    signals?: { signal: string; hit: boolean; score: number; detail: string }[];
  };
  conversation?: { role: string; text: string }[];
};

/** A finding with its synced evidence (dashboard `Evidence` type), or the metadata-only shape. */
function withEvidence(finding: ReturnType<typeof mapFinding>, row: Row | undefined, runExternalId: string) {
  if (!row) return { ...finding, evidence: { synced: false } };
  const d = (row.detail ?? {}) as Detail;
  return {
    ...finding,
    signals: (d.judge?.signals ?? []).map((s) => ({ signal: s.signal, hit: s.hit, score: s.score, detail: s.detail })),
    evidence: {
      synced: true,
      strategy: d.strategy ?? finding.strategy,
      payload: d.payload ?? "",
      transformChain: d.transforms ?? [],
      targetResponse: d.response ?? "",
      targetReasoning: d.reasoning ?? "",
      toolCalls: d.tool_calls ?? [],
      attackSequence: (d.conversation ?? []).map((t, i) => ({ step: i + 1, role: t.role, text: t.text })),
      objective: {
        title: d.objective?.title ?? "",
        category: d.objective?.category ?? "",
        successCriteria: d.objective?.success_criteria ?? "",
      },
      judge: { outcome: d.judge?.outcome ?? "", score: d.judge?.score ?? 0, rationale: d.judge?.rationale ?? "" },
      reproductionSteps: runExternalId ? `modelwrecker report runs/${runExternalId}` : undefined,
      syncedAt: str(row.updated_at),
    },
  };
}

function mapDevice(d: Row, w: World, now: Date) {
  const lastSeen = str(d.last_seen_at ?? d.created_at);
  const lastSync = w.runs
    .filter((r) => str(r.device_id) === str(d.id))
    .map((r) => str(r.created_at))
    .sort()
    .pop();
  const online = lastSeen && now.getTime() - Date.parse(lastSeen) < ONLINE_WINDOW_MS;
  return {
    id: str(d.id),
    name: str(d.name),
    status: online ? "online" : "offline",
    engineVersion: str(d.engine_version),
    os: str(d.os),
    lastSeenAt: lastSeen,
    lastSyncAt: lastSync ?? null,
    projectId: d.project_id ? str(d.project_id) : null,
    projectName: d.project_id ? str(byId(w.projects).get(str(d.project_id))?.name) || null : null,
    engineHealthy: true,
    fingerprint: str(d.id).slice(0, 8),
  };
}

function analytics(w: World) {
  const attempts = w.runs.reduce((a, r) => a + num(r.attempts), 0);
  const successes = w.runs.reduce((a, r) => a + num(r.successful_attacks), 0);
  const [ciLow, ciHigh] = wilson(successes, attempts);
  const severity = emptySeverity();
  for (const f of w.findings) severity[str(f.severity)] = (severity[str(f.severity)] ?? 0) + 1;

  const strategies = new Map<string, { attempts: number; successes: number }>();
  for (const r of w.runs) {
    for (const s of (r.by_strategy as { strategy: string; attempts: number; successes: number }[] | null) ?? []) {
      const acc = strategies.get(s.strategy) ?? { attempts: 0, successes: 0 };
      acc.attempts += num(s.attempts);
      acc.successes += num(s.successes);
      strategies.set(s.strategy, acc);
    }
  }

  const taxonomy = new Map<string, number>();
  for (const f of w.findings) for (const t of str(f.taxonomy).split(",").filter(Boolean)) taxonomy.set(t, (taxonomy.get(t) ?? 0) + 1);

  const perDay = new Map<string, { attempts: number; successes: number; runs: number; campaigns: Set<string>; findings: number }>();
  const slot = (d: string) => {
    let s = perDay.get(d);
    if (!s) perDay.set(d, (s = { attempts: 0, successes: 0, runs: 0, campaigns: new Set(), findings: 0 }));
    return s;
  };
  for (const r of w.runs) {
    const s = slot(day(r.completed_at ?? r.created_at));
    s.attempts += num(r.attempts);
    s.successes += num(r.successful_attacks);
    s.runs += 1;
    s.campaigns.add(str(r.campaign_id));
  }
  for (const f of w.findings) slot(day(f.discovered_at ?? f.created_at)).findings += 1;
  const days = [...perDay.keys()].filter(Boolean).sort();

  const leaderboard = w.targets
    .map((t) => {
      const ids = new Set(w.campaigns.filter((c) => str(c.target_id) === str(t.id)).map((c) => str(c.id)));
      const runs = w.runs.filter((r) => ids.has(str(r.campaign_id)));
      const a = runs.reduce((x, r) => x + num(r.attempts), 0);
      const s = runs.reduce((x, r) => x + num(r.successful_attacks), 0);
      const fs = w.findings.filter((f) => str(f.target_id) === str(t.id));
      const [lo, hi] = wilson(s, a);
      return {
        targetId: str(t.id),
        targetName: str(t.name),
        asr: a ? s / a : 0,
        ciLow: lo,
        ciHigh: hi,
        attempts: a,
        findings: fs.length,
        highCritical: fs.filter((f) => f.severity === "high" || f.severity === "critical").length,
      };
    })
    .filter((r) => r.attempts > 0);

  return {
    asr: attempts ? successes / attempts : 0,
    asrCiLow: ciLow,
    asrCiHigh: ciHigh,
    robustness: attempts ? 1 - successes / attempts : 0,
    totalAttempts: attempts,
    totalFindings: w.findings.length,
    severityBreakdown: severity,
    byStrategy: [...strategies.entries()].map(([strategy, v]) => ({
      strategy,
      attempts: v.attempts,
      asr: v.attempts ? v.successes / v.attempts : 0,
    })),
    // Objective categories are not part of the synced metadata yet, so this stays empty.
    byCategory: [],
    byTaxonomy: [...taxonomy.entries()].map(([key, count]) => {
      const [framework, ...rest] = key.split(":");
      return { framework, id: rest.join(":"), title: "", count };
    }),
    successRateOverTime: days.map((d) => {
      const s = perDay.get(d)!;
      return { date: d, value: s.attempts ? s.successes / s.attempts : 0 };
    }),
    findingsOverTime: days.map((d) => ({ date: d, value: perDay.get(d)!.findings })),
    campaignActivity: days.map((d) => {
      const s = perDay.get(d)!;
      return { date: d, campaigns: s.campaigns.size, runs: s.runs, successfulAttacks: s.successes };
    }),
    leaderboard,
  };
}

// --- routes ---------------------------------------------------------------------------------------

export function registerDashboardRoutes(app: Hono<AppEnv>, deps: Deps, requireUser: MiddlewareHandler<AppEnv>) {
  // Every handler below runs behind requireUser; owner is always the verified user, never input.
  const ctx = (c: Context<AppEnv>) => ({ db: c.get("db"), owner: c.get("user").id, now: deps.now() });
  const q = (c: Context<AppEnv>, k: string) => c.req.query(k) || undefined;
  const one = async (db: Db, table: string, id: string, owner: string) => {
    const [row] = await db.table(table).select({ eq: { id, owner_id: owner } });
    if (!row) throw new ApiError(404, "not_found", "Not found, or you do not have access to it.");
    return row;
  };

  // account
  app.get("/me", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const user = c.get("user");
    let [profile] = await db.table("profiles").select({ eq: { id: owner } });
    if (!profile) profile = await db.table("profiles").insert({ id: owner, email: user.email, display_name: user.name ?? user.email });
    const name = str(profile.display_name) || str(user.email);
    const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
    return c.json({
      id: owner,
      name,
      email: str(profile.email ?? user.email),
      role: "owner",
      organization: "Personal workspace",
      avatarInitials: initials,
      createdAt: str(profile.created_at),
      signInProvider: "google",
    });
  });

  app.patch("/me", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const body = await parse(c, NamePatch);
    await db.table("profiles").update({ id: owner }, { display_name: body.name });
    return c.json({ ok: true, name: body.name });
  });

  // overview + analytics
  app.get("/overview", requireUser, async (c) => {
    const { db, owner, now } = ctx(c);
    const w = scope(await loadWorld(db, owner), q(c, "projectId"));
    const attempts = w.runs.reduce((a, r) => a + num(r.attempts), 0);
    const successes = w.runs.reduce((a, r) => a + num(r.successful_attacks), 0);
    const since = now.getTime() - 30 * DAY_MS;
    return c.json({
      totalCampaigns: w.campaigns.length,
      activeTargets: w.targets.filter((t) => t.authorized).length,
      totalFindings: w.findings.length,
      criticalFindings: w.findings.filter((f) => f.severity === "critical").length,
      successfulAttacks: successes,
      attackSuccessRate: attempts ? successes / attempts : 0,
      connectedDevices: w.devices.filter((d) => now.getTime() - Date.parse(str(d.last_seen_at ?? d.created_at)) < ONLINE_WINDOW_MS).length,
      runsThisPeriod: w.runs.filter((r) => Date.parse(str(r.created_at)) >= since).length,
      // Period-over-period deltas need history the control plane does not keep yet.
      deltas: {},
    });
  });

  app.get("/analytics", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    return c.json(analytics(scope(await loadWorld(db, owner), q(c, "projectId"))));
  });

  // projects
  app.get("/projects", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const w = await loadWorld(db, owner);
    return c.json(w.projects.map((p) => mapProject(p, w)));
  });
  app.post("/projects", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const body = await parse(c, ProjectCreate);
    const p = await db.table("projects").insert({ owner_id: owner, name: body.name, description: body.description });
    return c.json(mapProject(p, await loadWorld(db, owner)), 201);
  });
  app.get("/projects/:id", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const p = await one(db, "projects", c.req.param("id"), owner);
    return c.json(mapProject(p, await loadWorld(db, owner)));
  });
  app.patch("/projects/:id", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const body = await parse(c, ProjectPatch);
    await one(db, "projects", c.req.param("id"), owner);
    const [p] = await db.table("projects").update({ id: c.req.param("id"), owner_id: owner }, { ...body, updated_at: new Date().toISOString() });
    return c.json(mapProject(p, await loadWorld(db, owner)));
  });
  app.delete("/projects/:id", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    await one(db, "projects", c.req.param("id"), owner);
    await db.table("projects").delete({ id: c.req.param("id"), owner_id: owner });
    return c.body(null, 204);
  });

  // targets (registration metadata only; the cloud never contacts a target)
  app.get("/targets", requireUser, async (c) => {
    const { db, owner, now } = ctx(c);
    const all = await loadWorld(db, owner);
    const w = scope(all, q(c, "projectId"));
    return c.json(w.targets.map((t) => mapTarget(t, all, now)));
  });
  app.post("/targets", requireUser, async (c) => {
    const { db, owner, now } = ctx(c);
    const body = await parse(c, TargetCreate);
    await one(db, "projects", body.projectId, owner);
    const dup = await db.table("targets").select({ eq: { owner_id: owner, project_id: body.projectId, name: body.name } });
    if (dup.length) throw new ApiError(409, "duplicate", "A target with that name already exists in this project.");
    const t = await db.table("targets").insert({
      owner_id: owner,
      project_id: body.projectId,
      name: body.name,
      type: body.type,
      provider: body.provider,
      endpoint: displayEndpoint(body.endpoint),
      model: body.model,
      authorized: true,
    });
    return c.json(mapTarget(t, await loadWorld(db, owner), now), 201);
  });
  app.get("/targets/:id", requireUser, async (c) => {
    const { db, owner, now } = ctx(c);
    const t = await one(db, "targets", c.req.param("id"), owner);
    return c.json(mapTarget(t, await loadWorld(db, owner), now));
  });

  // campaigns (configured here, executed only by the local engine)
  app.get("/campaigns", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const all = await loadWorld(db, owner);
    const targetId = q(c, "targetId");
    const rows = scope(all, q(c, "projectId")).campaigns.filter((x) => !targetId || str(x.target_id) === targetId);
    return c.json(rows.map((x) => mapCampaign(x, all)));
  });
  app.post("/campaigns", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const body = await parse(c, CampaignCreate);
    await one(db, "projects", body.projectId, owner);
    const target = await one(db, "targets", body.targetId, owner);
    if (str(target.project_id) !== body.projectId) throw new ApiError(422, "invalid_request", "targetId: the target belongs to another project");
    if (!target.authorized) throw new ApiError(422, "invalid_request", "targetId: the target is not authorized for testing");
    const row = await db.table("campaigns").insert({
      owner_id: owner,
      project_id: body.projectId,
      target_id: body.targetId,
      name: body.name,
      status: "draft",
      strategies: body.strategies,
      objective_count: body.objectiveCount,
      stop_condition: body.stopCondition,
      concurrency: body.concurrency,
      max_attempts: body.maxAttempts,
    });
    return c.json(mapCampaign(row, await loadWorld(db, owner)), 201);
  });
  app.get("/campaigns/:id", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const row = await one(db, "campaigns", c.req.param("id"), owner);
    return c.json(mapCampaign(row, await loadWorld(db, owner)));
  });
  app.patch("/campaigns/:id", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const body = await parse(c, NamePatch);
    await one(db, "campaigns", c.req.param("id"), owner);
    const [row] = await db.table("campaigns").update({ id: c.req.param("id"), owner_id: owner }, { name: body.name });
    return c.json(mapCampaign(row, await loadWorld(db, owner)));
  });
  app.delete("/campaigns/:id", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    await one(db, "campaigns", c.req.param("id"), owner);
    await db.table("campaigns").delete({ id: c.req.param("id"), owner_id: owner });
    return c.body(null, 204);
  });
  const move = (from: string, to: string) => async (c: Context<AppEnv>) => {
    const { db, owner } = ctx(c);
    const row = await one(db, "campaigns", c.req.param("id") ?? "", owner);
    if (row.status !== from) throw new ApiError(409, "invalid_state", `Only a ${from} campaign can move to ${to}.`);
    const [next] = await db.table("campaigns").update({ id: row.id, owner_id: owner, status: from }, { status: to });
    if (!next) throw new ApiError(409, "invalid_state", "The campaign changed. Reload and try again.");
    return c.json(mapCampaign(next, await loadWorld(db, owner)));
  };
  // The strongest campaign action: flag it so the user's local engine can pick it up.
  app.post("/campaigns/:id/ready", requireUser, move("draft", "ready"));
  app.post("/campaigns/:id/draft", requireUser, move("ready", "draft"));
  app.get("/campaigns/:id/timeline", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const row = await one(db, "campaigns", c.req.param("id"), owner);
    const w = await loadWorld(db, owner);
    const events = [
      { id: `${row.id}-created`, at: str(row.created_at), label: "Campaign created", detail: str(row.name), kind: "status" },
      ...campaignTotals(row, w).runs.map((r) => ({
        id: `run-${r.id}`,
        at: str(r.completed_at ?? r.created_at),
        label: "Run synced",
        detail: `${num(r.successful_attacks)} of ${num(r.attempts)} attempts succeeded`,
        kind: "attempt",
      })),
      ...w.findings
        .filter((f) => str(f.campaign_id) === str(row.id))
        .map((f) => ({ id: `finding-${f.id}`, at: str(f.discovered_at ?? f.created_at), label: "Finding verified", detail: str(f.title), kind: "finding" })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1));
    return c.json(events);
  });
  app.get("/campaigns/:id/stats", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const row = await one(db, "campaigns", c.req.param("id"), owner);
    const merged = new Map<string, { strategy: string; attempts: number; successes: number; partials: number }>();
    for (const r of campaignTotals(row, await loadWorld(db, owner)).runs) {
      for (const s of (r.by_strategy as { strategy: string; attempts: number; successes: number; partials: number }[] | null) ?? []) {
        const acc = merged.get(s.strategy) ?? { strategy: s.strategy, attempts: 0, successes: 0, partials: 0 };
        acc.attempts += num(s.attempts);
        acc.successes += num(s.successes);
        acc.partials += num(s.partials);
        merged.set(s.strategy, acc);
      }
    }
    return c.json({ campaignId: str(row.id), byStrategy: [...merged.values()] });
  });
  // Every attempt of every run in the campaign, when transcript sync is on and the run was synced
  // with it. Runs without a stored transcript are listed with `synced: false`.
  app.get("/campaigns/:id/transcript", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const row = await one(db, "campaigns", c.req.param("id"), owner);
    const runs = (await db.table("runs").select({ eq: { owner_id: owner, campaign_id: str(row.id) } })).sort((a, b) =>
      str(a.started_at) < str(b.started_at) ? -1 : 1,
    );
    const out = [];
    for (const r of runs) {
      const [t] = await db.table("run_transcripts").select({ eq: { run_id: str(r.id), owner_id: owner } });
      const attempts = ((t?.attempts as Record<string, unknown>[] | undefined) ?? []).map((a, i) => ({
        index: i + 1,
        at: iso(a.at),
        objective: str(a.objective),
        category: str(a.category),
        strategy: str(a.strategy),
        outcome: str(a.outcome),
        score: num(a.score),
        payload: str(a.payload),
        response: str(a.response),
      }));
      out.push({
        runId: str(r.id),
        runName: str(r.external_id),
        startedAt: iso(r.started_at),
        attemptCount: num(r.attempts),
        synced: Boolean(t),
        truncated: Boolean(t?.truncated),
        attempts,
      });
    }
    return c.json({ campaignId: str(row.id), runs: out });
  });

  // findings (lifecycle status only; evidence on the device is never touched)
  app.get("/findings", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const all = await loadWorld(db, owner);
    const campaignId = q(c, "campaignId");
    const targetId = q(c, "targetId");
    const rows = scope(all, q(c, "projectId")).findings.filter(
      (f) => (!campaignId || str(f.campaign_id) === campaignId) && (!targetId || str(f.target_id) === targetId),
    );
    return c.json(rows.map((f) => mapFinding(f, all)));
  });
  app.get("/findings/:id", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const f = await one(db, "findings", c.req.param("id"), owner);
    const w = await loadWorld(db, owner);
    const [evidence] = await db.table("finding_evidence").select({ eq: { finding_id: str(f.id), owner_id: owner } });
    const run = byId(w.runs).get(str(f.run_id));
    return c.json(withEvidence(mapFinding(f, w), evidence, str(run?.external_id)));
  });
  app.patch("/findings/:id", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const body = await parse(c, FindingPatch);
    await one(db, "findings", c.req.param("id"), owner);
    const [f] = await db.table("findings").update({ id: c.req.param("id"), owner_id: owner }, { status: body.status });
    return c.json(mapFinding(f, await loadWorld(db, owner)));
  });

  // devices
  app.get("/devices", requireUser, async (c) => {
    const { db, owner, now } = ctx(c);
    const all = await loadWorld(db, owner);
    return c.json(scope(all, q(c, "projectId")).devices.map((d) => mapDevice(d, all, now)));
  });
  app.get("/devices/:id", requireUser, async (c) => {
    const { db, owner, now } = ctx(c);
    const d = await one(db, "devices", c.req.param("id"), owner);
    if (d.revoked) throw new ApiError(404, "not_found", "Not found, or you do not have access to it.");
    return c.json(mapDevice(d, await loadWorld(db, owner), now));
  });
  app.patch("/devices/:id", requireUser, async (c) => {
    const { db, owner, now } = ctx(c);
    const body = await parse(c, NamePatch);
    await one(db, "devices", c.req.param("id"), owner);
    const [d] = await db.table("devices").update({ id: c.req.param("id"), owner_id: owner }, { name: body.name });
    return c.json(mapDevice(d, await loadWorld(db, owner), now));
  });
  app.post("/devices/:id/revoke", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    await one(db, "devices", c.req.param("id"), owner);
    // The token hash stays, flagged revoked, so the old token can never be accepted again.
    await db.table("devices").update({ id: c.req.param("id"), owner_id: owner }, { revoked: true });
    return c.body(null, 204);
  });

  // reports, billing, settings, notifications, search
  app.get("/reports", requireUser, (c) => c.json([])); // report files are not synced yet
  app.get("/plans", requireUser, (c) => c.json(PLANS));
  app.get("/invoices", requireUser, (c) => c.json([])); // no billing provider is live yet
  app.get("/subscription", requireUser, async (c) => {
    const { db, owner, now } = ctx(c);
    const [sub] = await db.table("subscriptions").select({ eq: { owner_id: owner } });
    const plan = planById(str(sub?.plan) || "free");
    const w = await loadWorld(db, owner);
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = sub?.current_period_end ? new Date(str(sub.current_period_end)) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return c.json({
      planId: plan.id,
      planName: plan.name,
      status: str(sub?.status) || "active",
      paymentStatus: plan.id === "free" ? "not_required" : "pending",
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      currency: "INR",
      usage: {
        campaigns: w.campaigns.length,
        attacks: w.runs.filter((r) => Date.parse(str(r.created_at)) >= start.getTime()).reduce((a, r) => a + num(r.attempts), 0),
        devices: w.devices.length,
        projects: w.projects.filter((p) => !p.archived).length,
      },
    });
  });
  const defaultSettings = { sync: { metadata: true, detailedEvidence: false, transcripts: false }, notifications: {} };
  const readSettings = async (db: Db, owner: string) => {
    const [p] = await db.table("profiles").select({ eq: { id: owner } });
    const s = (p?.settings as typeof defaultSettings | undefined) ?? defaultSettings;
    return { sync: { ...defaultSettings.sync, ...s.sync, metadata: true }, notifications: { ...s.notifications } };
  };
  app.get("/settings", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    return c.json(await readSettings(db, owner));
  });
  app.patch("/settings", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const body = await parse(c, SettingsPatch);
    const cur = await readSettings(db, owner);
    const next = {
      sync: { ...cur.sync, ...(body.sync ?? {}), metadata: true },
      notifications: { ...cur.notifications, ...(body.notifications ?? {}) },
    };
    await db.table("profiles").update({ id: owner }, { settings: next });
    // Turning detail off removes the copies already in the cloud. The local runs folder keeps the
    // originals, and turning it back on re-sends them on the next `modelwrecker sync`.
    if (cur.sync.detailedEvidence && !next.sync.detailedEvidence) {
      await db.table("finding_evidence").delete({ owner_id: owner });
      await db.table("findings").update({ owner_id: owner, evidence_synced: true }, { evidence_synced: false });
    }
    if (cur.sync.transcripts && !next.sync.transcripts) {
      await db.table("run_transcripts").delete({ owner_id: owner });
    }
    return c.json(next);
  });
  app.get("/notifications", requireUser, (c) => c.json([])); // notifications are not built yet
  app.get("/search", requireUser, async (c) => {
    const { db, owner } = ctx(c);
    const term = (c.req.query("q") ?? "").trim().slice(0, 80);
    if (term.length < 2) return c.json([]);
    const find = (table: string, column: string) =>
      db.table(table).select({ eq: { owner_id: owner }, ilike: { column, value: term }, limit: 5 });
    const [projects, targets, campaigns, findings, devices] = await Promise.all([
      find("projects", "name"),
      find("targets", "name"),
      find("campaigns", "name"),
      find("findings", "title"),
      find("devices", "name"),
    ]);
    return c.json([
      ...projects.map((r) => ({ id: str(r.id), kind: "project", title: str(r.name), subtitle: "Project", href: `/projects/${r.id}` })),
      ...targets.map((r) => ({ id: str(r.id), kind: "target", title: str(r.name), subtitle: `Target - ${str(r.type)}`, href: "/targets" })),
      ...campaigns.map((r) => ({ id: str(r.id), kind: "campaign", title: str(r.name), subtitle: "Campaign", href: `/campaigns/${r.id}` })),
      ...findings.map((r) => ({ id: str(r.id), kind: "finding", title: str(r.title), subtitle: `Finding - ${str(r.severity)}`, href: `/findings/${r.id}` })),
      ...devices.filter((r) => !r.revoked).map((r) => ({ id: str(r.id), kind: "device", title: str(r.name), subtitle: "Device", href: "/devices" })),
    ]);
  });
}
