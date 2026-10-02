import type { Context } from "hono";
import type { ZodTypeAny, z } from "zod";
import { ApiError } from "./lib";

const MAX_BODY_BYTES = 256 * 1024;

/** Read, size-cap, and validate a JSON body. Unknown fields fail validation (schemas are strict). */
export async function parseBody<S extends ZodTypeAny>(c: Context, schema: S): Promise<z.infer<S>> {
  const declared = Number(c.req.header("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw new ApiError(413, "payload_too_large", "Request body is too large.");
  const text = await c.req.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError(413, "payload_too_large", "Request body is too large.");
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be JSON.");
  }
  return schema.parse(raw);
}

