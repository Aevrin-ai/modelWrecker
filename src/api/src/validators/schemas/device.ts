import { z } from "zod";
import { shortText } from "./fields";

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
      .transform((code) => (code.includes("-") ? code : `${code.slice(0, 4)}-${code.slice(4)}`)),
    project_id: z.string().uuid().nullable().default(null),
    approve: z.boolean().default(true),
  })
  .strict();

export const HeartbeatReq = z.object({ engine_version: z.string().trim().max(20).default("") }).strict();
