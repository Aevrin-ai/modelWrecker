// Run with `npm test` (Node's built-in test runner; no test framework to install).
import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { sendWithSession, singleFlight, type TokenSource } from "./session.ts";

const rejected = () => new Response(JSON.stringify({ error: "unauthenticated", message: "Sign in to continue." }), { status: 401 });
const ok = () => new Response("{}", { status: 200 });

// a fake session: `valid` is the only token the fake API accepts; refresh rotates to the next one
function fakeSession(start: string | null, refreshTo: (string | null)[] = []) {
  let token = start;
  let valid = start;
  const state = {
    refreshes: 0,
    cleared: 0,
    expire() {
      valid = "rotated-elsewhere";
    },
  };
  const tokens: TokenSource = {
    current: async () => token,
    refresh: singleFlight(async () => {
      state.refreshes += 1;
      await new Promise((r) => setTimeout(r, 5));
      token = refreshTo.shift() ?? null;
      valid = token;
      return token;
    }),
    clear: async () => {
      state.cleared += 1;
      token = null;
    },
  };
  const send = mock.fn(async (t: string) => (t === valid ? ok() : rejected()));
  const sent = () => send.mock.calls.map((c) => c.arguments[0]);
  return { tokens, send, sent, state };
}

describe("sendWithSession", () => {
  it("sends with the current token and does not refresh when it is accepted", async () => {
    const { tokens, send, sent, state } = fakeSession("a1");
    const res = await sendWithSession(tokens, send);
    assert.equal(res?.status, 200);
    assert.deepEqual(sent(), ["a1"]);
    assert.equal(state.refreshes, 0);
  });

  it("refreshes once and retries once when the access token has expired", async () => {
    const { tokens, send, sent, state } = fakeSession("a1", ["a2"]);
    state.expire();
    const res = await sendWithSession(tokens, send);
    assert.equal(res?.status, 200);
    assert.deepEqual(sent(), ["a1", "a2"]);
    assert.equal(state.refreshes, 1);
    assert.equal(state.cleared, 0);
  });

  it("signs out when the refresh session is gone (expired, revoked, or reused)", async () => {
    const { tokens, send, state } = fakeSession("a1", [null]);
    state.expire();
    assert.equal(await sendWithSession(tokens, send), null);
    assert.equal(state.cleared, 1);
    assert.equal(send.mock.callCount(), 1);
  });

  it("does not loop: a retry that is rejected again signs out", async () => {
    const { tokens, state } = fakeSession("a1", ["a2", "a3"]);
    const send = mock.fn(async () => rejected());
    assert.equal(await sendWithSession(tokens, send), null);
    assert.equal(send.mock.callCount(), 2);
    assert.equal(state.refreshes, 1);
    assert.equal(state.cleared, 1);
  });

  it("signs out without sending when there is no session", async () => {
    const { tokens, send, state } = fakeSession(null);
    assert.equal(await sendWithSession(tokens, send), null);
    assert.equal(send.mock.callCount(), 0);
    assert.equal(state.cleared, 1);
  });

  it("shares one refresh between requests rejected at the same time", async () => {
    const { tokens, send, state } = fakeSession("a1", ["a2", "a3"]);
    state.expire();
    const results = await Promise.all([1, 2, 3, 4].map(() => sendWithSession(tokens, send)));
    assert.ok(results.every((r) => r?.status === 200));
    assert.equal(state.refreshes, 1);
  });

  it("uses a token another request already refreshed instead of rotating again", async () => {
    const { tokens, state } = fakeSession("a2");
    // This request read a1 before another request rotated the session to a2.
    let reads = 0;
    const stale: TokenSource = { ...tokens, current: async () => (reads++ === 0 ? "a1" : "a2") };
    const send = mock.fn(async (t: string) => (t === "a2" ? ok() : rejected()));
    assert.equal((await sendWithSession(stale, send))?.status, 200);
    assert.deepEqual(
      send.mock.calls.map((c) => c.arguments[0]),
      ["a1", "a2"],
    );
    assert.equal(state.refreshes, 0);
  });

  it("passes through a 401 that is not about the sign-in token", async () => {
    const { tokens, state } = fakeSession("a1");
    const res = await sendWithSession(tokens, async () => new Response(JSON.stringify({ error: "admin_session_required" }), { status: 401 }));
    assert.equal(res?.status, 401);
    assert.equal(state.refreshes, 0);
    assert.equal(state.cleared, 0);
  });

  it("passes through other errors untouched", async () => {
    const { tokens, state } = fakeSession("a1");
    const res = await sendWithSession(tokens, async () => new Response("{}", { status: 403 }));
    assert.equal(res?.status, 403);
    assert.equal(state.refreshes, 0);
  });
});

describe("singleFlight", () => {
  it("starts a new call once the previous one has settled", async () => {
    let calls = 0;
    const run = singleFlight(async () => ++calls);
    assert.deepEqual(await Promise.all([run(), run()]), [1, 1]);
    assert.equal(await run(), 2);
  });

  it("lets the next call retry after a failure", async () => {
    let calls = 0;
    const run = singleFlight(async () => {
      calls += 1;
      if (calls === 1) throw new Error("network");
      return "ok";
    });
    await assert.rejects(run(), /network/);
    assert.equal(await run(), "ok");
  });
});
