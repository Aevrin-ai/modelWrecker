import type { Context } from "hono";
import type { Deps } from "../types/deps";
import { ApiError } from "../lib/errors";
import { RateLimiter } from "../lib/rateLimiter";

const SLOW_DOWN = "Too many requests. Slow down and try again.";

/** The caller's address as Cloudflare reports it, or "local" outside Cloudflare. */
export function clientIp(c: Context): string {
  return c.req.header("cf-connecting-ip") ?? "local";
}

export type KeyLimit = (key: string, max: number, windowMs: number) => void;
export type IpLimit = (c: Context, bucket: string, max: number, windowMs: number) => void;

/** A best-effort limiter of its own: throws a 429 with `message` once a key passes `max` in its window. */
export function createKeyLimit(deps: Deps, message = SLOW_DOWN): KeyLimit {
  const limiter = new RateLimiter();
  return (key, max, windowMs) => {
    if (!limiter.allow(key, max, windowMs, deps.now().getTime())) {
      throw new ApiError(429, "rate_limited", message);
    }
  };
}

/** A limiter keyed by bucket and caller address, for the public and device routes. */
export function createIpLimit(deps: Deps): IpLimit {
  const limitKey = createKeyLimit(deps);
  return (c, bucket, max, windowMs) => limitKey(`${bucket}:${clientIp(c)}`, max, windowMs);
}
