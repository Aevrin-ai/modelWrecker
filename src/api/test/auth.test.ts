import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { MemoryDb } from "../src/database/memory";
import { FakeSupabaseAuth, VERIFIER, cleared, refreshCookie } from "./authHelpers";
import { readJson, type ErrorBody, type TestApp } from "./harness";

const ORIGIN = "https://app.aevrin.net";

interface SignInBody {
  accessToken: string;
  user: unknown;
}

let auth: FakeSupabaseAuth;
let app: TestApp;

beforeEach(() => {
  auth = new FakeSupabaseAuth();
  const db = new MemoryDb();
  app = createApp({
    serviceDb: db,
    userDb: () => db,
    verifyUser: async (token) => auth.userFor(token),
    appOrigin: ORIGIN,
    now: () => new Date("2026-10-11T10:00:00Z"),
    authTokens: auth,
  });
});

const SAME_SITE = { origin: ORIGIN, "sec-fetch-site": "same-origin", "x-aevrin-auth": "1" };

function post(path: string, opts: { body?: unknown; cookie?: string; token?: string; headers?: Record<string, string> } = {}) {
  return app.request(`/api/v1${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...SAME_SITE,
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...opts.headers,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

async function signIn() {
  const res = await post("/auth/session", { body: { code: "good-code", code_verifier: VERIFIER } });
  expect(res.status).toBe(200);
  return { res, body: await readJson<SignInBody>(res), cookie: refreshCookie(res)! };
}

describe("sign-in", () => {
  it("returns the access token and keeps the refresh token in an HttpOnly cookie only", async () => {
    const { res, body, cookie } = await signIn();
    expect(body.accessToken).toBe("at-2");
    expect(body.user).toEqual({ id: "user-a", email: "a@example.com", name: "Alice", avatarUrl: null });
    expect(JSON.stringify(body)).not.toContain("rt-");
    expect(cookie).toBe("__Secure-mw_rt=rt-2-abcdefgh");
    const refresh = res.headers.getSetCookie().find((line) => line.startsWith("__Secure-mw_rt="))!;
    expect(refresh).toMatch(/HttpOnly/);
    expect(refresh).toMatch(/Secure/);
    expect(refresh).toMatch(/SameSite=Strict/);
    expect(refresh).toMatch(/Path=\/api\/v1\/auth/);
    const hint = res.headers.getSetCookie().find((line) => line.startsWith("mw_signed_in="))!;
    expect(hint).toMatch(/^mw_signed_in=1;/);
    expect(hint).not.toMatch(/HttpOnly/);
  });

  it("refuses a wrong or reused code without saying which", async () => {
    await signIn();
    const reused = await post("/auth/session", { body: { code: "good-code", code_verifier: VERIFIER } });
    expect(reused.status).toBe(400);
    expect((await readJson<ErrorBody>(reused)).error).toBe("sign_in_failed");
    const wrongVerifier = await post("/auth/session", { body: { code: "other", code_verifier: "w".repeat(43) } });
    expect(wrongVerifier.status).toBe(400);
    expect(refreshCookie(wrongVerifier)).toBeNull();
  });

  it("rejects malformed input", async () => {
    expect((await post("/auth/session", { body: { code: "good-code", code_verifier: "short" } })).status).toBe(422);
    expect((await post("/auth/session", { body: { code: "a b", code_verifier: VERIFIER } })).status).toBe(422);
    expect((await post("/auth/session", { body: { code: "good-code", code_verifier: VERIFIER, extra: 1 } })).status).toBe(422);
    expect((await post("/auth/refresh", { body: { refresh_token: "bad token!" } })).status).toBe(422);
  });

  it("gives an access token that works on protected routes", async () => {
    const { body } = await signIn();
    const res = await app.request("/api/v1/projects", { headers: { authorization: `Bearer ${body.accessToken}` } });
    expect(res.status).toBe(200);
  });
});

describe("refresh", () => {
  it("issues a new access token and rotates the refresh token", async () => {
    const { cookie } = await signIn();
    const res = await post("/auth/refresh", { cookie });
    expect(res.status).toBe(200);
    expect((await readJson<SignInBody>(res)).accessToken).toBe("at-3");
    expect(refreshCookie(res)).toBe("__Secure-mw_rt=rt-3-abcdefgh");
  });

  it("treats reuse of a rotated refresh token as theft: the whole session ends", async () => {
    const { cookie: first } = await signIn();
    const second = refreshCookie(await post("/auth/refresh", { cookie: first }))!;
    const replay = await post("/auth/refresh", { cookie: first });
    expect(replay.status).toBe(401);
    expect((await readJson<ErrorBody>(replay)).error).toBe("session_ended");
    expect(cleared(replay)).toBe(true);
    // the legitimate holder's newer token is revoked too
    expect((await post("/auth/refresh", { cookie: second })).status).toBe(401);
  });

  it("ends the session for a missing, unknown, or revoked refresh token", async () => {
    const none = await post("/auth/refresh");
    expect(none.status).toBe(401);
    expect(cleared(none)).toBe(true);
    expect((await post("/auth/refresh", { cookie: "__Secure-mw_rt=rt-404-abcdefgh" })).status).toBe(401);
    const { cookie } = await signIn();
    // for example, an admin ban
    auth.revoked.add([...auth.refreshTokens.values()][0].session);
    expect((await post("/auth/refresh", { cookie })).status).toBe(401);
  });

  it("keeps the cookie through a Supabase outage", async () => {
    const { cookie } = await signIn();
    auth.down = true;
    const res = await post("/auth/refresh", { cookie });
    expect(res.status).toBe(503);
    expect(res.headers.getSetCookie()).toEqual([]);
    auth.down = false;
    expect((await post("/auth/refresh", { cookie })).status).toBe(200);
  });

  it("moves an older browser's localStorage session into the cookie once", async () => {
    await signIn();
    const res = await post("/auth/refresh", { body: { refresh_token: "rt-2-abcdefgh" } });
    expect(res.status).toBe(200);
    expect(refreshCookie(res)).toBe("__Secure-mw_rt=rt-3-abcdefgh");
  });

  it("never answers a refresh with an old token after logout", async () => {
    const { body, cookie } = await signIn();
    await post("/auth/logout", { token: body.accessToken, cookie });
    expect((await post("/auth/refresh", { cookie })).status).toBe(401);
  });
});

describe("cross-site requests", () => {
  it("refuses requests without the custom header, from another origin, or marked cross-site", async () => {
    const { cookie } = await signIn();
    const attempts: Record<string, string>[] = [{ "x-aevrin-auth": "" }, { origin: "https://evil.example" }, { "sec-fetch-site": "cross-site" }];
    for (const headers of attempts) {
      const res = await post("/auth/refresh", { cookie, headers });
      expect(res.status).toBe(403);
      expect(res.headers.getSetCookie()).toEqual([]);
    }
  });

  it("rate limits each address", async () => {
    let last = 0;
    for (let i = 0; i < 61; i++) last = (await post("/auth/refresh", { headers: { "cf-connecting-ip": "203.0.113.9" } })).status;
    expect(last).toBe(429);
  });
});

describe("logout", () => {
  it("revokes the session at Supabase Auth and clears both cookies", async () => {
    const { body, cookie } = await signIn();
    const res = await post("/auth/logout", { token: body.accessToken, cookie });
    expect(res.status).toBe(204);
    expect(cleared(res)).toBe(true);
    const after = await app.request("/api/v1/projects", { headers: { authorization: `Bearer ${body.accessToken}` } });
    expect(after.status).toBe(401);
  });

  it("still revokes the session when the access token has expired", async () => {
    const { body, cookie } = await signIn();
    auth.accessTokens.get(body.accessToken)!.expired = true;
    const res = await post("/auth/logout", { token: body.accessToken, cookie });
    expect(res.status).toBe(204);
    expect((await post("/auth/refresh", { cookie })).status).toBe(401);
    expect(auth.revoked.size).toBe(1);
  });

  it("clears the cookies even with nothing to revoke", async () => {
    const res = await post("/auth/logout");
    expect(res.status).toBe(204);
    expect(cleared(res)).toBe(true);
  });
});

describe("without Supabase Auth configured", () => {
  it("answers 503", async () => {
    const db = new MemoryDb();
    const bare = createApp({ serviceDb: db, userDb: () => db, verifyUser: async () => null, appOrigin: ORIGIN, now: () => new Date() });
    const res = await bare.request("/api/v1/auth/refresh", { method: "POST", headers: SAME_SITE });
    expect(res.status).toBe(503);
  });
});
