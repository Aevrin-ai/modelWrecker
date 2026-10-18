// result sync: metadata always; evidence and transcripts are stored only when the account's Settings allow them
import { z } from "zod";
import { SEVERITIES, TARGET_TYPES, count, isoOrNull, rate, shortText } from "./fields";

const EVIDENCE_TEXT_MAX = 20_000;
const TRANSCRIPT_TEXT_MAX = 4_000;
const body = (max: number) => z.string().max(max).default("");
const label = (max: number) => z.string().trim().max(max).default("");

const JudgeSignal = z
  .object({ signal: label(60), hit: z.boolean(), score: z.number().min(0).max(1), detail: body(1_000) })
  .strict();

const SyncJudge = z
  .object({
    outcome: label(40),
    score: z.number().int().min(0).max(10).default(0),
    rationale: body(4_000),
    signals: z.array(JudgeSignal).max(20).default([]),
  })
  .strict();

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
    judge: SyncJudge.default({}),
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

const SyncTarget = z
  .object({
    name: shortText(120),
    type: z.enum(TARGET_TYPES),
    model: z.string().trim().max(120).default(""),
    provider: z.string().trim().max(80).default(""),
  })
  .strict();

const SyncRun = z
  .object({
    run_id: shortText(80),
    campaign: z.object({ external_id: shortText(120), name: shortText(200) }).strict(),
    target: SyncTarget,
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
      .array(z.object({ strategy: shortText(80), attempts: count, successes: count, partials: count }).strict())
      .max(100)
      .default([]),
    findings: z.array(SyncFinding).max(500).default([]),
    transcript: z
      .object({ attempts: z.array(SyncAttempt).max(2_000), truncated: z.boolean().default(false) })
      .strict()
      .optional(),
  })
  .strict();

export const SyncReq = z
  .object({
    schema: z.literal(1),
    engine_version: z.string().trim().max(20).default(""),
    run: SyncRun,
  })
  .strict();

export type SyncBody = z.infer<typeof SyncReq>;
export type SyncRunBody = SyncBody["run"];
export type SyncFindingBody = SyncRunBody["findings"][number];
export type SyncEvidenceBody = z.infer<typeof SyncEvidence>;
