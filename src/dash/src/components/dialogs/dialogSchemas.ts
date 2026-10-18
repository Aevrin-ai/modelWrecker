import { z } from "zod";
import { TARGET_TYPES } from "@/lib/constants";

// a convenience for quick feedback; the control plane validates again on the server
export const nameSchema = z.string().trim().min(2, "Use at least 2 characters.").max(80, "Keep it under 80 characters.");

export const projectSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(80, "Keep it under 80 characters."),
  description: z.string().trim().max(400, "Keep it under 400 characters."),
});

export const targetSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(80),
  type: z.enum(TARGET_TYPES),
  provider: z.string().trim().min(1, "Name the provider, e.g. OpenAI or Local (Ollama)."),
  endpoint: z
    .string()
    .trim()
    .min(1, "Enter the endpoint host or path.")
    .refine((value) => !/[?&](api[_-]?key|token|key)=/i.test(value), "Do not put keys in the endpoint. Keys stay in the local engine's environment."),
  model: z.string().trim().min(1, "Enter the model name."),
  projectId: z.string().min(1, "Pick a project."),
  authorized: z.literal(true, { errorMap: () => ({ message: "You must confirm you are authorized to test this system." }) }),
});

export const campaignSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(80),
  projectId: z.string().min(1, "Pick a project."),
  targetId: z.string().min(1, "Pick a target."),
  strategies: z.array(z.string()).min(1, "Pick at least one strategy."),
  objectiveCount: z.number().int().min(1, "At least 1 objective.").max(500),
  stopCondition: z.enum(["complete", "first_finding", "budget"]),
  concurrency: z.number().int().min(1).max(32),
  maxAttempts: z.number().int().min(1).max(100000).nullable(),
});
