export const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|httpx|go-http/i;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// Cloudflare's codes for an unknown country and for Tor
export const UNKNOWN_COUNTRIES = ["XX", "T1"];

/** "/dashboard/campaigns/<uuid>?x=1#y" -> "/dashboard/campaigns/:id". */
export function cleanPath(raw: string): string {
  let path = raw.split(/[?#]/)[0] || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(UUID, ":id").replace(/\/\d{3,}(?=\/|$)/g, "/:id").replace(/\/{2,}/g, "/");
  return path.slice(0, 200);
}

/** A referrer reduced to its host, or null for direct visits and our own pages. */
export function referrerHost(raw: string, ownHost: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host === ownHost ? null : host.slice(0, 120);
  } catch {
    return null;
  }
}

export function deviceType(userAgent: string): "desktop" | "mobile" | "tablet" {
  if (/ipad|tablet|kindle|silk/i.test(userAgent) || (/android/i.test(userAgent) && !/mobile/i.test(userAgent))) return "tablet";
  if (/mobi|iphone|android/i.test(userAgent)) return "mobile";
  return "desktop";
}
