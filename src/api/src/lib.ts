// Small shared helpers: tokens and hashing, safe errors, best-effort rate limiting, Wilson interval.

/** An error that is safe to show the caller. Anything else becomes a generic 500. */
export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 410 | 413 | 422 | 429 | 500 | 502 | 503,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Unpadded base64url. Builds the string byte by byte, so large inputs do not overflow the call stack. */
export const b64url = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** A random URL-safe token with `bytes` bytes of entropy. */
export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return b64url(buf);
}

/** Hex SHA-256. Tokens and device codes are stored only as this hash. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// RFC 8628 section 6.1: consonants only, so a code never spells a word or confuses 0/O or 1/I.
const USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";

export function userCode(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  const chars = [...buf].map((b) => USER_CODE_ALPHABET[b % USER_CODE_ALPHABET.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

export const DEVICE_TOKEN_PREFIX = "mwd_";

/** Best-effort fixed-window limiter, per Worker instance. Upgrade path: a Cloudflare rate-limit binding. */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  allow(key: string, limit: number, windowMs: number, now: number): boolean {
    const slot = this.hits.get(key);
    if (!slot || slot.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + windowMs });
      if (this.hits.size > 10_000) this.hits.clear(); // bound memory
      return true;
    }
    slot.count += 1;
    return slot.count <= limit;
  }
}

/** Wilson 95% interval, matching the engine's analytics (src/modelwrecker/reliability/replay.py). */
export function wilson(successes: number, n: number): [number, number] {
  if (n <= 0) return [0, 0];
  const z = 1.959963984540054;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (centre - margin) / denom), Math.min(1, (centre + margin) / denom)];
}

export function bearer(header: string | undefined | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return m ? m[1] : null;
}

/** Keep only scheme, host, port, and path of a target endpoint. Drops credentials and query strings. */
export function displayEndpoint(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return "";
  }
}
