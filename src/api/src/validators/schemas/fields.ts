import { z } from "zod";

export const shortText = (max: number) => z.string().trim().min(1).max(max);
export const isoOrNull = z.string().datetime({ offset: true }).nullable();
export const rate = z.number().min(0).max(1);
export const count = z.number().int().min(0).max(10_000_000);

export const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export const TARGET_TYPES = ["chat", "agent", "rag", "mcp", "memory", "multi_agent"] as const;
