import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { MemoryDb } from "../src/db/memory";
import type { AuthTokens, GrantResult } from "../src/db";

const ORIGIN = "https://app.aevrin.net";
const VERIFIER = "v".repeat(43);

/** Stands in for Supabase Auth: one-time codes, rotating refresh tokens, and reuse revoking the session. */
class FakeSupabaseAuth implements AuthTokens {
  codes = new Map([["good-code", "user-a"]]);
  /** refresh token -> session; `used` once rotated. */
  refreshTokens = new Map<string, { session: string; used: boolean }>();
  accessTokens = new Map<string, { session: string; expired: boolean }>();
  revoked = new Set<string>();
  down = false;
  private n = 0;

  private issue(session: string): GrantResult {
    const n = ++this.n;
    this.refreshTokens.set(`rt-${n}-abcdefgh`, { session, used: false });
    this.accessTokens.set(`at-${n}`, { session, expired: false });
    return {
      ok: true,
      grant: {
        accessToken: `at-${n}`,
        refreshToken: `rt-${n}-abcdefgh`,
        expiresAt: 1_900_000_000,
        user: { id: "user-a", email: "a@example.com", name: "Alice", avatarUrl: null },
      },
    };
  }

  async exchangeCode(code: string, verifier: string): Promise<GrantResult> {
    if (this.down) return { ok: false, reason: "unavailable" };
    if (!this.codes.has(code) || verifier !== VERIFIER) return { ok: false, reason: "invalid" };
    this.codes.delete(code);
    return this.issue(`session-${++this.n}`);
  }

  async refresh(token: string): Promise<GrantResult> {
    if (this.down) return { ok: false, reason: "unavailable" };
    const rt = this.refreshTokens.get(token);
    if (!rt || this.revoked.has(rt.session)) return { ok: false, reason: "invalid" };
    if (rt.used) {
      this.revoked.add(rt.session); // reuse: the whole session is revoked
      return { ok: false, reason: "invalid" };
    }
    rt.used = true;
    return this.issue(rt.session);
  }

  async signOut(accessToken: string): Promise<boolean> {
    const at = this.accessTokens.get(accessToken);
    if (!at || at.expired || this.revoked.has(at.session)) return false;
    this.revoked.add(at.session);
    return true;
  }

  userFor(accessToken: string) {
    const at = this.accessTokens.get(accessToken);
    return at && !at.expired && !this.revoked.has(at.session) ? { id: "user-a", email: "a@example.com", name: "Alice" } : null;
  }
}

let auth: FakeSupabaseAuth;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  auth = new FakeSupabaseAuth();
  const db = new MemoryDb();
  app = createApp({
    serviceDb: db,
    userDb: () => db,
    verifyUser: async (t) => auth.userFor(t),
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

/** The refresh cookie a response sets, as a `cookie` request header, or null when it is cleared or absent. */
function refreshCookie(res: Response): string | null {
  const line = res.headers.getSetCookie().find((c) => c.startsWith("__Secure-mw_rt="));
  if (!line) return null;
  const value = line.split(";")[0];
  return value === "__Secure-mw_rt=" ? null : value;
}

const cleared = (res: Response) => {
  const lines = res.headers.getSetCookie();
  return ["__Secure-mw_rt=", "mw_signed_in="].every((name) => lines.some((l) => l.startsWith(name) && /Max-Age=0/i.test(l)));
};

async function signIn() {
  const res = await post("/auth/session", { body: { code: "good-code", code_verifier: VERIFIER } });
  expect(res.status).toBe(200);
  return { res, body: (await res.json()) as Record<string, any>, cookie: refreshCookie(res)! };
}

describe("sign-in", () => {
  it("returns the access token and keeps the refresh token in an HttpOnly cookie only", async () => {
    const { res, body, cookie } = await signIn();
    expect(body.accessToken).toBe("at-2");
    expect(body.user).toEqual({ id: "user-a", email: "a@example.com", name: "Alice", avatarUrl: null });
    expect(JSON.stringify(body)).not.toContain("rt-");
    expect(cookie).toBe("__Secure-mw_rt=rt-2-abcdefgh");
    const rt = res.headers.getSetCookie().find((c) => c.startsWith("__Secure-mw_rt="))!;
    expect(rt).toMatch(/HttpOnly/);
    expect(rt).toMatch(/Secure/);
    expect(rt).toMatch(/SameSite=Strict/);
    expect(rt).toMatch(/Path=\/api\/v1\/auth/);
    const hint = res.headers.getSetCookie().find((c) => c.startsWith("mw_signed_in="))!;
    expect(hint).toMatch(/^mw_signed_in=1;/);
    expect(hint).not.toMatch(/HttpOnly/);
  });

  it("refuses a wrong or reused code without saying which", async () => {
    await signIn();
    const reused = await post("/auth/session", { body: { code: "good-code", code_verifier: VERIFIER } });
    expect(reused.status).toBe(400);
    expect(((await reused.json()) as any).error).toBe("sign_in_failed");
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
    expect(((await res.json()) as any).accessToken).toBe("at-3");
    expect(refreshCookie(res)).toBe("__Secure-mw_rt=rt-3-abcdefgh");
  });

  it("treats reuse of a rotated refresh token as theft: the whole session ends", async () => {
    const { cookie: first } = await signIn();
    const second = refreshCookie(await post("/auth/refresh", { cookie: first }))!;
    const replay = await post("/auth/refresh", { cookie: first });
    expect(replay.status).toBe(401);
    expect(((await replay.json()) as any).error).toBe("session_ended");
    expect(cleared(replay)).toBe(true);
    // The legitimate holder's newer token is revoked too.
    expect((await post("/auth/refresh", { cookie: second })).status).toBe(401);
  });

  it("ends the session for a missing, unknown, or revoked refresh token", async () => {
    const none = await post("/auth/refresh");
    expect(none.status).toBe(401);
    expect(cleared(none)).toBe(true);
    expect((await post("/auth/refresh", { cookie: "__Secure-mw_rt=rt-404-abcdefgh" })).status).toBe(401);
    const { cookie } = await signIn();
    auth.revoked.add([...auth.refreshTokens.values()][0].session); // for example, an admin ban
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
