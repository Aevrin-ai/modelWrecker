import type { Context } from "hono";
import type { Deps } from "../types/deps";
import { RateLimiter } from "../lib/rateLimiter";
import { sha256Hex } from "../lib/tokens";
import { errorFields, log } from "../lib/log";
import { CollectReq } from "../validators/schemas";
import { BOT, UNKNOWN_COUNTRIES, cleanPath, referrerHost, deviceType } from "../services/pageViews";
import { pageViewsRepository } from "../repositories/pageViews";

const MAX_BYTES = 2048;

interface Visitor {
  address: string;
  userAgent: string;
}

// Do Not Track, Global Privacy Control, obvious bots, and floods are not counted
function countableVisitor(c: Context, deps: Deps, limiter: RateLimiter): Visitor | null {
  const address = c.req.header("cf-connecting-ip") ?? "";
  const userAgent = c.req.header("user-agent") ?? "";
  if (!address || !userAgent || BOT.test(userAgent)) return null;
  if (c.req.header("dnt") === "1" || c.req.header("sec-gpc") === "1") return null;
  if (!limiter.allow(`collect:${address}`, 60, 60_000, deps.now().getTime())) return null;
  return { address, userAgent };
}

async function readBeacon(c: Context) {
  const text = await c.req.text();
  if (text.length > MAX_BYTES) return null;
  try {
    return CollectReq.parse(JSON.parse(text));
  } catch {
    return null;
  }
}

function countryOf(c: Context): string | null {
  const cloudflare = (c.req.raw as Request & { cf?: { country?: string } }).cf;
  const country = (cloudflare?.country ?? c.req.header("cf-ipcountry") ?? "").toUpperCase().slice(0, 2) || null;
  return country && UNKNOWN_COUNTRIES.includes(country) ? null : country;
}

export async function recordPageView(c: Context, deps: Deps, limiter: RateLimiter, ownHost: string): Promise<void> {
  if (!deps.analyticsSalt) return;
  const visitor = countableVisitor(c, deps, limiter);
  if (!visitor) return;
  const body = await readBeacon(c);
  if (!body) return;
  const now = deps.now();
  const day = now.toISOString().slice(0, 10);
  const country = countryOf(c);
  try {
    // no raw IP or user agent is stored: a salted daily hash cannot be reversed or linked across days
    const visitorHash = await sha256Hex(`${deps.analyticsSalt}|${day}|${visitor.address}|${visitor.userAgent}`);
    await pageViewsRepository(deps.serviceDb).insert({
      day,
      ts: now.toISOString(),
      site: body.s,
      path: cleanPath(body.p),
      referrer: referrerHost(body.r, ownHost),
      country,
      device: deviceType(visitor.userAgent),
      visitor: visitorHash.slice(0, 32),
    });
  } catch (err) {
    // analytics must never fail the page; note it and move on
    log.warn("page_view_not_stored", errorFields(err));
  }
}
