/** Best-effort fixed-window limiter, per Worker instance. Upgrade path: a Cloudflare rate-limit binding. */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  allow(key: string, limit: number, windowMs: number, now: number): boolean {
    const slot = this.hits.get(key);
    if (!slot || slot.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + windowMs });
      // bound memory: a flood of distinct keys resets the window for everyone rather than growing forever
      if (this.hits.size > 10_000) this.hits.clear();
      return true;
    }
    slot.count += 1;
    return slot.count <= limit;
  }
}
