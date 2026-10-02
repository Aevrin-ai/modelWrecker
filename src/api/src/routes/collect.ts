// First-party page analytics (issue #45, docs/analytics/page-analytics.md).
//
// The landing page and the dashboard send one small beacon per page view. Privacy by design:
//   - no cookie, no local storage, no third-party script;
//   - no raw IP or user agent is stored: the visitor column is SHA-256(secret, day, IP, user agent), so it
//     changes every day and cannot be reversed or linked across days without the server secret;
//   - paths are stripped of query strings and ids, referrers are reduced to a host name;
//   - a browser that sends Do Not Track or Global Privacy Control is not counted, nor are obvious bots.
import type { Hono } from "hono";
import type { AppEnv } from "../app";
import type { Deps } from "../db";
import { RateLimiter, sha256Hex } from "../lib";
import { CollectReq } from "../schemas";

const MAX_BYTES = 2048;
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|httpx|go-http/i;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** "/dashboard/campaigns/<uuid>?x=1#y" -> "/dashboard/campaigns/:id". */
export function cleanPath(raw: string): string {
  let p = raw.split(/[?#]/)[0] || "/";
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(UUID, ":id").replace(/\/\d{3,}(?=\/|$)/g, "/:id").replace(/\/{2,}/g, "/");
  return p.slice(0, 200);
}

/** A referrer reduced to its host, or null for direct visits and our own pages. */
export function referrerHost(raw: string, ownHost: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return host === ownHost ? null : host.slice(0, 120);
  } catch {
    return null;
  }
}

export function deviceType(ua: string): "desktop" | "mobile" | "tablet" {
  if (/ipad|tablet|kindle|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

export function registerCollectRoute(app: Hono<AppEnv>, deps: Deps) {
  const limiter = new RateLimiter();
  const ownHost = new URL(deps.appOrigin).hostname.toLowerCase();

  app.post("/collect", async (c) => {
    // Always 204: a beacon must never show an error or reveal whether it was counted.
    const done = () => c.body(null, 204);
    if (!deps.analyticsSalt) return done();
    const ip = c.req.header("cf-connecting-ip") ?? "";
    const ua = c.req.header("user-agent") ?? "";
    if (!ip || !ua || BOT.test(ua)) return done();
    if (c.req.header("dnt") === "1" || c.req.header("sec-gpc") === "1") return done();
    if (!limiter.allow(`collect:${ip}`, 60, 60_000, deps.now().getTime())) return done();

    const text = await c.req.text();
    if (text.length > MAX_BYTES) return done();
    let body;
    try {
      body = CollectReq.parse(JSON.parse(text));
    } catch {
      return done();
    }
    const now = deps.now();
    const day = now.toISOString().slice(0, 10);
    const cf = (c.req.raw as Request & { cf?: { country?: string } }).cf;
    const country = (cf?.country ?? c.req.header("cf-ipcountry") ?? "").toUpperCase().slice(0, 2) || null;
    try {
      await deps.serviceDb.table("page_views").insert({
        day,
        ts: now.toISOString(),
        site: body.s,
        path: cleanPath(body.p),
        referrer: referrerHost(body.r, ownHost),
        country: country === "XX" || country === "T1" ? null : country,
        device: deviceType(ua),
        visitor: (await sha256Hex(`${deps.analyticsSalt}|${day}|${ip}|${ua}`)).slice(0, 32),
      });
    } catch (err) {
      console.error("page view not stored", err instanceof Error ? err.message : String(err));
    }
    return done();
  });
}
