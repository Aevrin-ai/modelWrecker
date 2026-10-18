// Outbound HTTP: one time budget per call, and a bounded retry for GET and HEAD only.

export interface FetchPolicy {
  /** The whole budget for one call: every attempt and every wait between attempts. */
  timeoutMs: number;
  /** Extra attempts for a GET or HEAD after a network failure, a 429, or a 502, 503, or 504. */
  retries: number;
}

export interface FetchDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

// a database answer normally takes milliseconds; 10 s is far past normal and below the CLI's own 15 s
export const SUPABASE_POLICY: FetchPolicy = { timeoutMs: 10_000, retries: 1 };
export const RAZORPAY_POLICY: FetchPolicy = { timeoutMs: 15_000, retries: 1 };

const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const BASE_DELAY_MS = 200;
// a request cannot sit waiting long; a server that asks for more than this gets its answer passed on
const MAX_DELAY_MS = 2000;

/** A fetch with the policy applied. Same signature as the global, so an SDK can take it as its fetch. */
export function createFetch(policy: FetchPolicy, deps: FetchDeps = {}): typeof fetch {
  const send = deps.fetch ?? ((input, init) => fetch(input, init));
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const random = deps.random ?? Math.random;

  return async (input, init = {}) => {
    const method = (init.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    // a repeated POST could create an order, refund twice, or reuse a single-use refresh token
    const attempts = method === "GET" || method === "HEAD" ? policy.retries + 1 : 1;
    const signal = withDeadline(init.signal ?? undefined, policy.timeoutMs);

    for (let attempt = 1; ; attempt += 1) {
      const isLast = attempt >= attempts;
      let res: Response;
      try {
        res = await send(input, { ...init, signal });
      } catch (err) {
        if (isLast || signal.aborted) throw err;
        await sleep(backoffDelay(attempt, random));
        continue;
      }
      if (isLast || signal.aborted || !RETRY_STATUSES.has(res.status)) return res;
      const wait = retryWait(res.headers.get("retry-after"), attempt, random);
      if (wait === null) return res;
      await res.body?.cancel();
      await sleep(wait);
    }
  };
}

/** Exponential backoff with jitter for retry number `attempt` (1 is the first retry). */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
  // half fixed, half random, so callers that failed together do not all retry at the same moment
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

/** How long to wait before a retry, or null when the server asked for longer than one call can wait. */
export function retryWait(retryAfter: string | null, attempt: number, random: () => number = Math.random, now = Date.now()): number | null {
  const asked = retryAfterMs(retryAfter, now);
  if (asked === null) return backoffDelay(attempt, random);
  return asked > MAX_DELAY_MS ? null : asked;
}

/** A Retry-After header as milliseconds: delay-seconds or an HTTP date. Null when absent or unreadable. */
export function retryAfterMs(header: string | null, now = Date.now()): number | null {
  if (!header) return null;
  const value = header.trim();
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return null;
  return Math.max(0, retryAt - now);
}

function withDeadline(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const deadline = AbortSignal.timeout(ms);
  if (!signal) return deadline;
  // keep the caller's own cancel too where the runtime can combine signals; otherwise the deadline wins
  return typeof AbortSignal.any === "function" ? AbortSignal.any([signal, deadline]) : deadline;
}
