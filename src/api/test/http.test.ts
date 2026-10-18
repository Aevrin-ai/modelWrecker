import { describe, expect, it } from "vitest";
import { backoffDelay, createFetch, retryAfterMs, retryWait } from "../src/lib/http";

const URL_UNDER_TEST = "https://example.test/rows";

/** A fetch that answers from a script, one step per call, and records each call's method. */
function scriptedFetch(steps: Array<Response | Error>) {
  const methods: string[] = [];
  const send = async (_input: RequestInfo | URL, init?: RequestInit) => {
    methods.push(init?.method ?? "GET");
    const step = steps.shift();
    if (!step) throw new Error("the script ran out of answers");
    if (step instanceof Error) throw step;
    return step;
  };
  return { send: send as typeof fetch, methods };
}

function recordingSleep() {
  const waits: number[] = [];
  return { sleep: async (ms: number) => void waits.push(ms), waits };
}

describe("outbound fetch policy", () => {
  it("retries a GET once after a network failure and returns the second answer", async () => {
    const { send, methods } = scriptedFetch([new TypeError("fetch failed"), new Response("ok")]);
    const { sleep } = recordingSleep();
    const res = await createFetch({ timeoutMs: 5000, retries: 1 }, { fetch: send, sleep })(URL_UNDER_TEST);
    expect(await res.text()).toBe("ok");
    expect(methods).toEqual(["GET", "GET"]);
  });

  it("retries a GET after a 503 and stops at the retry limit", async () => {
    const { send, methods } = scriptedFetch([new Response("", { status: 503 }), new Response("", { status: 503 })]);
    const { sleep } = recordingSleep();
    const res = await createFetch({ timeoutMs: 5000, retries: 1 }, { fetch: send, sleep })(URL_UNDER_TEST);
    expect(res.status).toBe(503);
    expect(methods).toHaveLength(2);
  });

  it("never retries a POST after a network failure, so a payment or refresh is never sent twice", async () => {
    const { send, methods } = scriptedFetch([new TypeError("fetch failed"), new Response("ok")]);
    const fetchWithPolicy = createFetch({ timeoutMs: 5000, retries: 3 }, { fetch: send, sleep: recordingSleep().sleep });
    await expect(fetchWithPolicy(URL_UNDER_TEST, { method: "POST" })).rejects.toThrow("fetch failed");
    expect(methods).toEqual(["POST"]);
  });

  it("never retries a POST that answered 503", async () => {
    const { send, methods } = scriptedFetch([new Response("", { status: 503 }), new Response("ok")]);
    const res = await createFetch({ timeoutMs: 5000, retries: 3 }, { fetch: send, sleep: recordingSleep().sleep })(URL_UNDER_TEST, {
      method: "POST",
    });
    expect(res.status).toBe(503);
    expect(methods).toHaveLength(1);
  });

  it("does not retry an answer that will not change, such as a 404", async () => {
    const { send, methods } = scriptedFetch([new Response("", { status: 404 }), new Response("ok")]);
    const res = await createFetch({ timeoutMs: 5000, retries: 3 }, { fetch: send, sleep: recordingSleep().sleep })(URL_UNDER_TEST);
    expect(res.status).toBe(404);
    expect(methods).toHaveLength(1);
  });

  it("waits as long as Retry-After asks when that fits in one call", async () => {
    const { send } = scriptedFetch([new Response("", { status: 429, headers: { "Retry-After": "1" } }), new Response("ok")]);
    const { sleep, waits } = recordingSleep();
    const res = await createFetch({ timeoutMs: 5000, retries: 1 }, { fetch: send, sleep })(URL_UNDER_TEST);
    expect(res.status).toBe(200);
    expect(waits).toEqual([1000]);
  });

  it("passes the answer on at once when Retry-After asks for longer than one call can wait", async () => {
    const { send, methods } = scriptedFetch([new Response("", { status: 503, headers: { "Retry-After": "30" } }), new Response("ok")]);
    const { sleep, waits } = recordingSleep();
    const res = await createFetch({ timeoutMs: 5000, retries: 1 }, { fetch: send, sleep })(URL_UNDER_TEST);
    expect(res.status).toBe(503);
    expect(methods).toHaveLength(1);
    expect(waits).toEqual([]);
  });

  it("gives up when the time budget runs out instead of trying again", async () => {
    let calls = 0;
    // never answers on its own; only the deadline can end it
    const hang = (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        calls += 1;
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    const fetchWithPolicy = createFetch({ timeoutMs: 30, retries: 3 }, { fetch: hang as typeof fetch });
    await expect(fetchWithPolicy(URL_UNDER_TEST)).rejects.toBeDefined();
    expect(calls).toBe(1);
  });
});

describe("backoff and Retry-After", () => {
  it("backs off exponentially with jitter and never past the cap", () => {
    expect(backoffDelay(1, () => 0)).toBe(100);
    expect(backoffDelay(1, () => 1)).toBe(200);
    expect(backoffDelay(2, () => 0)).toBe(200);
    expect(backoffDelay(2, () => 1)).toBe(400);
    expect(backoffDelay(10, () => 1)).toBe(2000);
    expect(backoffDelay(10, () => 0)).toBe(1000);
  });

  it("reads Retry-After as seconds or as an HTTP date", () => {
    const now = Date.parse("2026-10-18T10:00:00Z");
    expect(retryAfterMs("3", now)).toBe(3000);
    expect(retryAfterMs("Sun, 18 Oct 2026 10:00:05 GMT", now)).toBe(5000);
    expect(retryAfterMs("Sun, 18 Oct 2026 09:00:00 GMT", now)).toBe(0);
    expect(retryAfterMs("soon", now)).toBeNull();
    expect(retryAfterMs(null, now)).toBeNull();
  });

  it("falls back to backoff when the server gives no Retry-After", () => {
    expect(retryWait(null, 1, () => 0)).toBe(backoffDelay(1, () => 0));
  });
});
