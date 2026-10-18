import { z } from "zod";
import { TARGET_TYPES, shortText } from "./fields";

const FINDING_STATUSES = ["open", "triaged", "fixed", "accepted-risk"] as const;

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
    // the user must confirm they may test this system; anything but `true` is refused
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
