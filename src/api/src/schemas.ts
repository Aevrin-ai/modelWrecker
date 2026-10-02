// Request schemas. Every body is strict: unknown fields are rejected, so a client cannot slip in an
// owner id, a project id it does not own, or sensitive content the contract does not allow.
import { z } from "zod";

const shortText = (max: number) => z.string().trim().min(1).max(max);
const isoOrNull = z.string().datetime({ offset: true }).nullable();
const rate = z.number().min(0).max(1);
const count = z.number().int().min(0).max(10_000_000);

export const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export const FINDING_STATUSES = ["open", "triaged", "fixed", "accepted-risk"] as const;
export const TARGET_TYPES = ["chat", "agent", "rag", "mcp"] as const;

// --- device sign-in ---------------------------------------------------------------------------

export const DeviceCodeReq = z
  .object({
    name: shortText(80),
    os: z.string().trim().max(60).default(""),
    engine_version: z.string().trim().max(20).default(""),
  })
  .strict();

export const DeviceTokenReq = z.object({ device_code: z.string().min(20).max(128) }).strict();

export const DeviceApproveReq = z
  .object({
    user_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{4}-?[A-Z]{4}$/, "expected a code like WDJB-MJHT")
      .transform((v) => (v.includes("-") ? v : `${v.slice(0, 4)}-${v.slice(4)}`)),
    project_id: z.string().uuid().nullable().default(null),
    approve: z.boolean().default(true),
  })
  .strict();

export const HeartbeatReq = z.object({ engine_version: z.string().trim().max(20).default("") }).strict();

// --- result sync (see docs/architecture/control-plane-api.md) ---------------------------------------
// Metadata always. Evidence and transcripts are optional detail, stored only when the account turned
// them on in Settings (checked on the server, see ingestRun). The engine redacts secrets before sending.

export const EVIDENCE_TEXT_MAX = 20_000;
export const TRANSCRIPT_TEXT_MAX = 4_000;
const body = (max: number) => z.string().max(max).default("");
const label = (max: number) => z.string().trim().max(max).default("");

const SyncEvidence = z
  .object({
    objective: z
      .object({ title: label(300), category: label(80), success_criteria: body(2_000) })
      .strict()
      .default({}),
    strategy: label(80),
    transforms: z.array(label(80)).max(30).default([]),
    payload: body(EVIDENCE_TEXT_MAX),
    response: body(EVIDENCE_TEXT_MAX),
    reasoning: body(EVIDENCE_TEXT_MAX),
    tool_calls: z
      .array(z.object({ name: label(120), args: body(4_000) }).strict())
      .max(50)
      .default([]),
    judge: z
      .object({
        outcome: label(40),
        score: z.number().int().min(0).max(10).default(0),
        rationale: body(4_000),
        signals: z
          .array(
            z
              .object({ signal: label(60), hit: z.boolean(), score: z.number().min(0).max(1), detail: body(1_000) })
              .strict(),
          )
          .max(20)
          .default([]),
      })
      .strict()
      .default({}),
    conversation: z
      .array(z.object({ role: label(20), text: body(TRANSCRIPT_TEXT_MAX) }).strict())
      .max(100)
      .default([]),
  })
  .strict();

const SyncAttempt = z
  .object({
    at: isoOrNull,
    objective: label(300),
    category: label(80),
    strategy: label(80),
    outcome: label(40),
    score: z.number().int().min(0).max(10).default(0),
    payload: body(TRANSCRIPT_TEXT_MAX),
    response: body(TRANSCRIPT_TEXT_MAX),
  })
  .strict();

const SyncFinding = z
  .object({
    id: shortText(64),
    title: shortText(300),
    severity: z.enum(SEVERITIES),
    score: z.number().int().min(0).max(10).default(0),
    strategy: z.string().trim().max(80).default(""),
    taxonomy: z
      .array(z.object({ framework: shortText(40), id: shortText(40) }).strict())
      .max(20)
      .default([]),
    replays: count,
    successes: count,
    success_rate: rate,
    ci_low: rate,
    ci_high: rate,
    confidence: z.enum(["reliable", "flaky", "does_not_hold"]),
    discovered_at: isoOrNull,
    evidence: SyncEvidence.optional(),
  })
  .strict();

export const SyncReq = z
  .object({
    schema: z.literal(1),
    engine_version: z.string().trim().max(20).default(""),
    run: z
      .object({
        run_id: shortText(80),
        campaign: z.object({ external_id: shortText(120), name: shortText(200) }).strict(),
        target: z
          .object({
            name: shortText(120),
            type: z.enum(TARGET_TYPES),
            model: z.string().trim().max(120).default(""),
            provider: z.string().trim().max(80).default(""),
          })
          .strict(),
        started_at: isoOrNull,
        completed_at: isoOrNull,
        attempts: count,
        successes: count,
        partials: count,
        refusals: count,
        errors: count,
        asr: rate,
        asr_ci_low: rate,
        asr_ci_high: rate,
        by_strategy: z
          .array(
            z
              .object({ strategy: shortText(80), attempts: count, successes: count, partials: count })
              .strict(),
          )
          .max(100)
          .default([]),
        findings: z.array(SyncFinding).max(500).default([]),
        transcript: z
          .object({ attempts: z.array(SyncAttempt).max(2_000), truncated: z.boolean().default(false) })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict();

export type SyncBody = z.infer<typeof SyncReq>;
export type SyncEvidenceBody = z.infer<typeof SyncEvidence>;

// --- dashboard ------------------------------------------------------------------------------------

export const ProjectCreate = z
  .object({ name: shortText(120), description: z.string().trim().max(2000).default("") })
  .strict();

export const ProjectPatch = z
  .object({
    name: shortText(120).optional(),
    description: z.string().trim().max(2000).optional(),
    archived: z.boolean().optional(),
  })
  .strict();

export const TargetCreate = z
  .object({
    name: shortText(120),
    type: z.enum(TARGET_TYPES),
    provider: z.string().trim().max(80).default(""),
    endpoint: z.string().trim().max(500).default(""),
    model: z.string().trim().max(120).default(""),
    projectId: z.string().uuid(),
    // The user must confirm they may test this system. Anything but `true` is refused.
    authorized: z.literal(true),
  })
  .strict();

export const CampaignCreate = z
  .object({
    name: shortText(200),
    projectId: z.string().uuid(),
    targetId: z.string().uuid(),
    strategies: z.array(shortText(80)).min(1).max(30),
    objectiveCount: z.number().int().min(1).max(1000),
    stopCondition: z.enum(["complete", "first_finding", "budget"]),
    concurrency: z.number().int().min(1).max(64),
    maxAttempts: z.number().int().min(1).max(1_000_000).nullable(),
  })
  .strict();

export const NamePatch = z.object({ name: shortText(200) }).strict();

export const FindingPatch = z.object({ status: z.enum(FINDING_STATUSES) }).strict();

export const SettingsPatch = z
  .object({
    sync: z
      .object({
        metadata: z.literal(true).optional(),
        detailedEvidence: z.boolean().optional(),
        transcripts: z.boolean().optional(),
      })
      .strict()
      .optional(),
    notifications: z.record(z.string().max(40), z.boolean()).optional(),
  })
  .strict();

// --- billing (docs/billing/razorpay.md) ------------------------------------------------------------

export const CheckoutReq = z
  .object({
    plan: z.literal("pro"),
    interval: z.enum(["month", "year"]),
  })
  .strict();

const rzpId = (prefix: string) => z.string().trim().regex(new RegExp(`^${prefix}_[A-Za-z0-9]{6,40}$`), `expected a ${prefix}_ id`);

export const VerifyPaymentReq = z
  .object({
    razorpay_order_id: rzpId("order"),
    razorpay_payment_id: rzpId("pay"),
    razorpay_signature: z.string().trim().regex(/^[a-f0-9]{64}$/i, "expected a hex signature"),
  })
  .strict();

// --- admin console (docs/security/admin.md) ---------------------------------------------------------
// Every change to a user needs a reason; it goes into the audit log.

const reason = z.string().trim().min(3, "give a reason (it is kept in the audit log)").max(500);
const meter = z.number().int().min(0).max(10_000_000);

export const MfaCodeReq = z
  .object({
    code: z.string().trim().regex(/^\d{6}$/, "expected a 6-digit code").optional(),
    recoveryCode: z.string().trim().min(8).max(32).optional(),
  })
  .strict()
  .refine((b) => Boolean(b.code) !== Boolean(b.recoveryCode), "send either a code or a recovery code");

export const AdminPlanPatch = z
  .object({
    plan: z.enum(["free", "pro", "enterprise"]),
    paidUntil: z.string().datetime({ offset: true }).nullable(),
    reason,
  })
  .strict();

export const AdminBonus = z
  .object({ campaigns: meter, attacks: meter, devices: meter, projects: meter, expiresAt: z.string().datetime({ offset: true }).nullable(), reason })
  .strict();

export const AdminCredit = z
  .object({ deltaPaise: z.number().int().min(-10_000_000).max(10_000_000).refine((n) => n !== 0, "must not be zero"), reason })
  .strict();

export const AdminReason = z.object({ reason }).strict();

export const AdminSuspend = z.object({ suspended: z.boolean(), reason }).strict();

export const AdminDelete = z.object({ confirmEmail: z.string().trim().min(3).max(320), reason }).strict();

export const AdminSettings = z
  .object({ sync: z.object({ detailedEvidence: z.boolean(), transcripts: z.boolean() }).strict(), reason })
  .strict();

export const AdminProfile = z.object({ displayName: shortText(200), reason }).strict();

// --- page analytics beacon (docs/analytics/page-analytics.md) --------------------------------------

export const CollectReq = z
  .object({
    s: z.enum(["landing", "dashboard"]),
    p: z.string().max(500),
    r: z.string().max(1000).default(""),
  })
  .strict();
