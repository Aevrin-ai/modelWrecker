import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { AuthUser, Database, Deps, Table } from "../src/types/deps";
import { MemoryDb } from "../src/database/memory";
import { DbError } from "../src/lib/errors";
import { checkDatabase } from "../src/services/health";

const USERS: Record<string, AuthUser> = { "token-a": { id: "user-a", email: "a@example.com", name: "Alice" } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.restoreAllMocks();
});

/** A database where every call throws `err`. */
function failingDb(err: Error): Database {
  const fail = async (): Promise<never> => {
    throw err;
  };
  const table: Table = { select: fail, count: fail, insert: fail, update: fail, delete: fail, upsert: fail };
  return { table: () => table, rpc: fail };
}

/** A database whose reads never answer. */
function hangingDb(): Database {
  const hang = () => new Promise<never>(() => {});
  const table: Table = { select: hang, count: hang, insert: hang, update: hang, delete: hang, upsert: hang };
  return { table: () => table, rpc: hang };
}

function appWith(over: Partial<Deps> = {}) {
  const db = new MemoryDb();
  return createApp({
    serviceDb: db,
    userDb: () => db,
    verifyUser: async (token) => USERS[token] ?? null,
    appOrigin: "https://vyra.aevrin.ai",
    now: () => new Date("2026-10-18T10:00:00Z"),
    ...over,
  });
}

const get = (app: ReturnType<typeof createApp>, path: string, headers: Record<string, string> = {}) =>
  app.request(`/api/v1${path}`, { headers });

interface Body {
  error?: string;
  message?: string;
  requestId?: string;
}

const readBody = async (res: Response) => (await res.json()) as Body;

describe("request ids", () => {
  it("puts the same request id in the header and the body of an error", async () => {
    const res = await get(appWith(), "/no-such-route");
    expect(res.status).toBe(404);
    const id = res.headers.get("x-request-id");
    expect(id).toMatch(UUID);
    expect((await readBody(res)).requestId).toBe(id);
  });

  it("puts a request id on a successful response too", async () => {
    expect((await get(appWith(), "/health")).headers.get("x-request-id")).toMatch(UUID);
  });

  it("uses Cloudflare's ray id when it has the expected shape", async () => {
    const res = await get(appWith(), "/health", { "cf-ray": "8a1b2c3d4e5f6789-SIN" });
    expect(res.headers.get("x-request-id")).toBe("8a1b2c3d4e5f6789-SIN");
  });

  it("ignores a ray id with the wrong shape and makes a fresh one", async () => {
    const res = await get(appWith(), "/health", { "cf-ray": "not-a-ray; anything" });
    expect(res.headers.get("x-request-id")).toMatch(UUID);
  });

  it("keeps a known error's code and message and adds the request id", async () => {
    const res = await get(appWith(), "/projects");
    expect(res.status).toBe(401);
    const body = await readBody(res);
    expect(body.error).toBe("unauthenticated");
    expect(body.requestId).toBe(res.headers.get("x-request-id"));
  });
});

describe("failures", () => {
  it("answers 503 service_unavailable when the database cannot answer, without its detail", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const app = appWith({ userDb: () => failingDb(new DbError("connect ECONNREFUSED 10.0.0.5:5432", "PGRST000")) });
    const res = await get(app, "/projects", { authorization: "Bearer token-a" });
    expect(res.status).toBe(503);
    const body = await readBody(res);
    expect(body).toEqual({ error: "service_unavailable", message: expect.any(String), requestId: res.headers.get("x-request-id") });
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("answers a generic 500 for an unexpected failure and logs the detail with the request id", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = appWith({ userDb: () => failingDb(new DbError('duplicate key value violates unique constraint "profiles_email_key"', "23505")) });
    const res = await get(app, "/projects", { authorization: "Bearer token-a" });
    expect(res.status).toBe(500);
    const body = await readBody(res);
    expect(body.error).toBe("internal");
    expect(JSON.stringify(body)).not.toContain("profiles_email_key");
    expect(JSON.parse(error.mock.calls[0][0] as string)).toMatchObject({
      level: "error",
      event: "request_failed",
      requestId: body.requestId,
      method: "GET",
      path: "/api/v1/projects",
      status: 500,
      errorName: "DbError",
    });
  });
});

describe("readiness", () => {
  it("reports ready when the database answers", async () => {
    const res = await get(appWith(), "/health/ready");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, checks: { database: "ok" } });
  });

  it("reports not ready, with no internals, when the database fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const app = appWith({ serviceDb: failingDb(new DbError("password authentication failed for user postgres", "28P01")) });
    const res = await get(app, "/health/ready");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, checks: { database: "unavailable" } });
  });

  it("counts a database that is too slow as unavailable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await checkDatabase(hangingDb(), 20)).toBe("unavailable");
  });

  it("rate limits the readiness check, because it is public and touches the database", async () => {
    const app = appWith();
    for (let i = 0; i < 30; i += 1) expect((await get(app, "/health/ready")).status).toBe(200);
    expect((await get(app, "/health/ready")).status).toBe(429);
  });

  it("keeps the liveness check free of any database call", async () => {
    const res = await get(appWith({ serviceDb: failingDb(new DbError("down", "PGRST000")) }), "/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
