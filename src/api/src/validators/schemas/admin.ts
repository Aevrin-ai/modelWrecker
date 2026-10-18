// admin console bodies (docs/security/admin.md); every change to a user needs a reason for the audit log
import { z } from "zod";
import { shortText } from "./fields";

const reason = z.string().trim().min(3, "give a reason (it is kept in the audit log)").max(500);
const meter = z.number().int().min(0).max(10_000_000);
const isoDateTime = () => z.string().datetime({ offset: true });

export const MfaCodeReq = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "expected a 6-digit code")
      .optional(),
    recoveryCode: z.string().trim().min(8).max(32).optional(),
  })
  .strict()
  .refine((body) => Boolean(body.code) !== Boolean(body.recoveryCode), "send either a code or a recovery code");

export const AdminPlanPatch = z
  .object({
    plan: z.enum(["free", "pro", "enterprise"]),
    paidUntil: isoDateTime().nullable(),
    reason,
  })
  .strict();

export const AdminBonus = z
  .object({
    campaigns: meter,
    attacks: meter,
    devices: meter,
    projects: meter,
    expiresAt: isoDateTime().nullable(),
    reason,
  })
  .strict();

export const AdminCredit = z
  .object({
    deltaPaise: z
      .number()
      .int()
      .min(-10_000_000)
      .max(10_000_000)
      .refine((delta) => delta !== 0, "must not be zero"),
    reason,
  })
  .strict();

export const AdminReason = z.object({ reason }).strict();

export const AdminSuspend = z.object({ suspended: z.boolean(), reason }).strict();

export const AdminDelete = z.object({ confirmEmail: z.string().trim().min(3).max(320), reason }).strict();

export const AdminSettings = z
  .object({ sync: z.object({ detailedEvidence: z.boolean(), transcripts: z.boolean() }).strict(), reason })
  .strict();

export const AdminProfile = z.object({ displayName: shortText(200), reason }).strict();
