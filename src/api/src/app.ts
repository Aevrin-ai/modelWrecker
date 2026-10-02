// The control-plane API. Metadata only: there is deliberately no route that runs an attack, calls a
// model or a target, runs a command, or fetches a URL. See docs/architecture/control-plane-api.md.
import { Hono, type Context } from "hono";
import { ZodError, type z } from "zod";
import { MAX_SYNC_BODY_BYTES, parseBody } from "./body";
import type { AuthUser, Db, Deps, Row } from "./db";
import {
  ApiError,
  DEVICE_TOKEN_PREFIX,
  RateLimiter,
  bearer,
  randomToken,
  sha256Hex,
  userCode,
} from "./lib";
import { DeviceApproveReq, DeviceCodeReq, DeviceTokenReq, HeartbeatReq, SyncReq, type SyncEvidenceBody } from "./schemas";
import { registerBillingRoutes } from "./routes/billing";
import { registerDashboardRoutes } from "./routes/dashboard";
import { issueEntitlement } from "./entitlements";
import { effectivePlan } from "./plans";
import { ensureDefaultProject, readSyncPolicy, type SyncPolicy } from "./routes/shared";

export type AppEnv = {
  Variables: {
    user: AuthUser;
    db: Db;
    device: Row;
  };
};

const DEVICE_CODE_TTL_S = 15 * 60;
const POLL_INTERVAL_S = 5;

/** RFC 8628 errors are returned as 400 with the standard error code. */
const oauthError = (c: Context, code: string) => c.json({ error: code }, 400);

export function createApp(deps: Deps) {
  const app = new Hono<AppEnv>().basePath("/api/v1");
  const limiter = new RateLimiter();
  const clientIp = (c: Context) => c.req.header("cf-connecting-ip") ?? "local";
  const limit = (c: Context, bucket: string, max: number, windowMs: number) => {
    if (!limiter.allow(`${bucket}:${clientIp(c)}`, max, windowMs, deps.now().getTime())) {
      throw new ApiError(429, "rate_limited", "Too many requests. Slow down and try again.");
    }
  };

  // Security headers on every response. Same-origin only: no CORS headers are emitted, so a browser
  // on another origin cannot read responses.
  app.use("*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
  });

  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ error: err.code, message: err.message }, err.status);
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      const where = issue?.path.join(".") || "body";
      return c.json({ error: "invalid_request", message: `${where}: ${issue?.message ?? "invalid"}` }, 422);
    }
    console.error("unhandled error", err instanceof Error ? err.message : String(err));
    return c.json({ error: "internal", message: "Something went wrong. Please try again." }, 500);
  });

  app.notFound((c) => c.json({ error: "not_found", message: "No such route." }, 404));

  app.get("/health", (c) => c.json({ ok: true }));

  // The public half of the entitlement signing key, so anyone can check a token the engine holds.
  app.get("/entitlements/keys", (c) =>
    c.json({ keys: deps.signer ? [{ kid: deps.signer.keyId, kty: "OKP", crv: "Ed25519", alg: "EdDSA", x: deps.signer.publicKey }] : [] }),
  );

  // --- device sign-in (RFC 8628) --------------------------------------------------------------------

  app.post("/device/code", async (c) => {
    limit(c, "device-code", 10, 60_000);
    const body = await parseBody(c, DeviceCodeReq);
    const deviceCode = randomToken(32);
    const now = deps.now();
    let code = userCode();
    for (let i = 0; i < 5; i++) {
      const clash = await deps.serviceDb.table("device_auth_requests").select({ eq: { user_code: code } });
      if (clash.length === 0) break;
      code = userCode();
    }
    await deps.serviceDb.table("device_auth_requests").insert({
      device_code_hash: await sha256Hex(deviceCode),
      user_code: code,
      name: body.name,
      os: body.os,
      engine_version: body.engine_version,
      status: "pending",
      expires_at: new Date(now.getTime() + DEVICE_CODE_TTL_S * 1000).toISOString(),
    });
    const uri = `${deps.appOrigin}/dashboard/connect`;
    return c.json({
      device_code: deviceCode,
      user_code: code,
      verification_uri: uri,
      verification_uri_complete: `${uri}?code=${code}`,
      expires_in: DEVICE_CODE_TTL_S,
      interval: POLL_INTERVAL_S,
    });
  });

  app.post("/device/token", async (c) => {
    limit(c, "device-token", 120, 60_000);
    const body = await parseBody(c, DeviceTokenReq);
    const requests = deps.serviceDb.table("device_auth_requests");
    const [req] = await requests.select({ eq: { device_code_hash: await sha256Hex(body.device_code) } });
    const now = deps.now();
    if (!req || new Date(String(req.expires_at)).getTime() <= now.getTime()) return oauthError(c, "expired_token");

    const last = req.last_polled_at ? new Date(String(req.last_polled_at)).getTime() : 0;
    await requests.update({ id: req.id }, { last_polled_at: now.toISOString() });
    if (last && now.getTime() - last < (POLL_INTERVAL_S - 1) * 1000) return oauthError(c, "slow_down");

    if (req.status === "pending") return oauthError(c, "authorization_pending");
    if (req.status === "denied") return oauthError(c, "access_denied");
    if (req.status !== "approved") return oauthError(c, "expired_token");

    // Claim the approval exactly once. A concurrent second poll finds nothing to claim.
    const claimed = await requests.update({ id: req.id, status: "approved" }, { status: "consumed" });
    if (claimed.length !== 1) return oauthError(c, "expired_token");

    // Mint the token now and return it once. Only its hash is stored.
    const token = `${DEVICE_TOKEN_PREFIX}${randomToken(32)}`;
    const device = await deps.serviceDb.table("devices").insert({
      owner_id: req.owner_id,
      project_id: req.project_id ?? null,
      name: req.name,
      os: req.os ?? "",
      engine_version: req.engine_version ?? "",
      credential_hash: await sha256Hex(token),
      last_seen_at: now.toISOString(),
      revoked: false,
    });
    await requests.update({ id: req.id }, { device_id: device.id });
    return c.json({ device_token: token, device_id: device.id, project_id: req.project_id ?? null });
  });

  // --- device-authenticated routes ----------------------------------------------------------------
  // Auth is attached per route, never as a catch-all, so device and user credentials can never be
  // accepted on each other's routes.

  const deviceAuth = async (c: Context<AppEnv>, next: () => Promise<void>) => {
    limit(c, "device", 120, 60_000);
    const token = bearer(c.req.header("authorization"));
    if (!token || !token.startsWith(DEVICE_TOKEN_PREFIX)) {
      throw new ApiError(401, "invalid_token", "A device token is required.");
    }
    const [row] = await deps.serviceDb
      .table("devices")
      .select({ eq: { credential_hash: await sha256Hex(token) } });
    if (!row || row.revoked) throw new ApiError(401, "invalid_token", "This device token is not valid.");
    c.set("device", row);
    await next();
  };

  app.post("/device/heartbeat", deviceAuth, async (c) => {
    const body = await parseBody(c, HeartbeatReq);
    const d = c.get("device");
    const patch: Row = { last_seen_at: deps.now().toISOString() };
    if (body.engine_version) patch.engine_version = body.engine_version;
    await deps.serviceDb.table("devices").update({ id: d.id }, patch);
    // Tell the engine which detail the account allows, so it only sends what will be kept, and hand it a
    // fresh signed entitlement.
    return c.json({ ok: true, sync: await devicePolicy(deps, d), ...(await entitlementFor(deps, d)) });
  });

  app.get("/device/me", deviceAuth, async (c) => {
    const d = c.get("device");
    return c.json({
      device_id: d.id,
      project_id: d.project_id ?? null,
      name: d.name,
      sync: await devicePolicy(deps, d),
    });
  });

  app.get("/device/entitlement", deviceAuth, async (c) => {
    const ent = await entitlementFor(deps, c.get("device"));
    if (!ent.entitlement) throw new ApiError(503, "entitlements_unavailable", "Entitlements are not available right now.");
    return c.json(ent);
  });

  app.post("/sync", deviceAuth, async (c) => {
    const body = await parseBody(c, SyncReq, MAX_SYNC_BODY_BYTES);
    const result = await ingestRun(deps, c.get("device"), body);
    return c.json({ ok: true, ...result });
  });

  // --- user approval of a device sign-in ----------------------------------------------------------

  const requireUser = userAuth(deps);

  app.post("/device/approve", requireUser, async (c) => {
    limit(c, "device-approve", 20, 60_000);
    const body = await parseBody(c, DeviceApproveReq);
    const user = c.get("user");
    const requests = deps.serviceDb.table("device_auth_requests");
    const [req] = await requests.select({ eq: { user_code: body.user_code } });
    if (!req) throw new ApiError(404, "unknown_code", "That code was not found. Check it and try again.");
    if (new Date(String(req.expires_at)).getTime() <= deps.now().getTime()) {
      throw new ApiError(410, "expired_token", "That code has expired. Run modelwrecker login again.");
    }
    if (req.status !== "pending") throw new ApiError(409, "already_used", "That code was already used.");

    if (body.approve) {
      const [sub] = await deps.serviceDb.table("subscriptions").select({ eq: { owner_id: user.id } });
      const max = effectivePlan(sub, deps.now()).limits.devices;
      const linked = (await deps.serviceDb.table("devices").select({ eq: { owner_id: user.id } })).filter((d) => !d.revoked).length;
      if (max !== null && linked >= max) {
        throw new ApiError(403, "plan_limit", `Your plan allows ${max} connected device${max === 1 ? "" : "s"}. Revoke one in Devices, or upgrade.`);
      }
    }

    if (!body.approve) {
      await requests.update({ id: req.id, status: "pending" }, { status: "denied", owner_id: user.id });
      return c.json({ denied: true });
    }

    const db = c.get("db");
    let projectId: string;
    if (body.project_id) {
      const [p] = await db.table("projects").select({ eq: { id: body.project_id, owner_id: user.id } });
      if (!p) throw new ApiError(404, "unknown_project", "That project was not found.");
      projectId = String(p.id);
    } else {
      projectId = await ensureDefaultProject(db, user.id);
    }
    const updated = await requests.update(
      { id: req.id, status: "pending" },
      { status: "approved", owner_id: user.id, project_id: projectId },
    );
    if (updated.length !== 1) throw new ApiError(409, "already_used", "That code was already used.");
    return c.json({ approved: true });
  });

  // --- dashboard (user) routes --------------------------------------------------------------------

  registerDashboardRoutes(app, deps, requireUser);
  registerBillingRoutes(app, deps, requireUser);

  return app;
}

/** User authentication: verify the Supabase token, then query as that user so RLS applies. */
export function userAuth(deps: Deps) {
  return async (c: Context<AppEnv>, next: () => Promise<void>) => {
    const token = bearer(c.req.header("authorization"));
    if (!token || token.startsWith(DEVICE_TOKEN_PREFIX)) {
      throw new ApiError(401, "unauthenticated", "Sign in to continue.");
    }
    const user = await deps.verifyUser(token);
    if (!user) throw new ApiError(401, "unauthenticated", "Your session has expired. Sign in again.");
    c.set("user", user);
    c.set("db", deps.userDb(token));
    await next();
  };
}

async function devicePolicy(deps: Deps, device: Row) {
  const policy = await readSyncPolicy(deps.serviceDb, String(device.owner_id), deps.now());
  return { metadata: true, evidence: policy.evidence, transcripts: policy.transcripts };
}

/** A fresh signed entitlement for a device, or nothing when signing is not configured (free baseline). */
async function entitlementFor(deps: Deps, device: Row): Promise<{ entitlement?: string; plan?: string; expires_at?: string }> {
  if (!deps.signer) return {};
  const { token, payload } = await issueEntitlement(deps.signer, deps.serviceDb, deps.appOrigin, device, deps.now());
  return { entitlement: token, plan: payload.plan, expires_at: new Date(payload.exp * 1000).toISOString() };
}

/** The stored shape of one finding's evidence. Text was already redacted by the engine. */
function evidenceDetail(e: SyncEvidenceBody) {
  return {
    objective: e.objective,
    strategy: e.strategy,
    transforms: e.transforms,
    payload: e.payload,
    response: e.response,
    reasoning: e.reasoning,
    tool_calls: e.tool_calls,
    judge: e.judge,
    conversation: e.conversation,
  };
}

/** Store one synced run. Everything is pinned to the device's owner and project, never the body's. */
async function ingestRun(deps: Deps, device: Row, body: z.infer<typeof SyncReq>) {
  const db = deps.serviceDb;
  const owner = String(device.owner_id);
  const projectId = device.project_id ? String(device.project_id) : null;
  if (!projectId) throw new ApiError(409, "no_project", "This device is not linked to a project.");
  const run = body.run;
  const now = deps.now().toISOString();
  // Detail is kept only when the account allows it. The client's choice to send it is not enough.
  const policy: SyncPolicy = await readSyncPolicy(db, owner, deps.now());

  // Target: create on first sight; never overwrite a target the user registered in the dashboard.
  const targets = db.table("targets");
  let [target] = await targets.select({ eq: { owner_id: owner, project_id: projectId, name: run.target.name } });
  if (!target) {
    target = await targets.insert({
      owner_id: owner,
      project_id: projectId,
      name: run.target.name,
      type: run.target.type,
      provider: run.target.provider,
      model: run.target.model,
      endpoint: "",
      authorized: true, // the engine refuses to run against a target without authorized: true
    });
  }

  // Campaign keyed by the engine's campaign id within this project.
  const campaigns = db.table("campaigns");
  const strategies = run.by_strategy.map((s) => s.strategy);
  let [campaign] = await campaigns.select({
    eq: { owner_id: owner, project_id: projectId, external_id: run.campaign.external_id },
  });
  if (campaign) {
    const merged = Array.from(new Set([...((campaign.strategies as string[]) ?? []), ...strategies]));
    [campaign] = await campaigns.update(
      { id: campaign.id },
      {
        status: "completed",
        target_id: target.id,
        device_id: device.id,
        strategies: merged,
        completed_at: run.completed_at ?? now,
      },
    );
  } else {
    campaign = await campaigns.insert({
      owner_id: owner,
      project_id: projectId,
      external_id: run.campaign.external_id,
      name: run.campaign.name,
      status: "completed",
      target_id: target.id,
      device_id: device.id,
      strategies,
      started_at: run.started_at,
      completed_at: run.completed_at ?? now,
    });
  }

  const runRow = await db.table("runs").upsert(
    {
      owner_id: owner,
      external_id: run.run_id,
      campaign_id: campaign.id,
      device_id: device.id,
      model: run.target.model,
      provider: run.target.provider,
      attempts: run.attempts,
      successful_attacks: run.successes,
      partials: run.partials,
      refusals: run.refusals,
      errors: run.errors,
      success_rate: run.asr,
      asr_ci_low: run.asr_ci_low,
      asr_ci_high: run.asr_ci_high,
      by_strategy: run.by_strategy,
      started_at: run.started_at,
      completed_at: run.completed_at,
    },
    ["owner_id", "external_id"],
  );

  // Findings keyed by the engine's finding id. `status` is never sent, so a lifecycle status the user
  // set in the dashboard survives a re-sync. `evidence_synced` is only ever set here when evidence is
  // stored, so a later metadata-only sync does not hide evidence that is already in the cloud.
  let evidenceStored = 0;
  for (const f of run.findings) {
    const keep = policy.evidence && f.evidence !== undefined;
    const row = await db.table("findings").upsert(
      {
        owner_id: owner,
        external_id: f.id,
        project_id: projectId,
        campaign_id: campaign.id,
        target_id: target.id,
        run_id: runRow.id,
        title: f.title,
        severity: f.severity,
        score: f.score,
        technique: f.strategy,
        taxonomy: f.taxonomy.map((t) => `${t.framework}:${t.id}`).join(","),
        replays: f.replays,
        successes: f.successes,
        success_rate: f.success_rate,
        confidence_low: f.ci_low,
        confidence_high: f.ci_high,
        confidence: f.confidence,
        discovered_at: f.discovered_at,
        last_seen_at: now,
        ...(keep ? { evidence_synced: true } : {}),
      },
      ["owner_id", "external_id"],
    );
    if (keep && f.evidence) {
      await db.table("finding_evidence").upsert(
        { finding_id: row.id, owner_id: owner, detail: evidenceDetail(f.evidence), updated_at: now },
        ["finding_id"],
      );
      evidenceStored += 1;
    }
  }

  let transcriptStored = false;
  if (policy.transcripts && run.transcript) {
    await db.table("run_transcripts").upsert(
      {
        run_id: runRow.id,
        owner_id: owner,
        attempts: run.transcript.attempts,
        truncated: run.transcript.truncated,
        updated_at: now,
      },
      ["run_id"],
    );
    transcriptStored = true;
  }

  await db.table("devices").update({ id: device.id }, { last_seen_at: now });
  return {
    campaign_id: String(campaign.id),
    run_id: String(runRow.id),
    findings: run.findings.length,
    // What the account allows right now, and what was kept from this body. The engine records this
    // so a run synced without detail is sent again once detail is turned on.
    detail: { evidence: policy.evidence, transcripts: policy.transcripts },
    stored: { evidence: evidenceStored, transcript: transcriptStored },
  };
}
