// the app with an in-memory database and two users, for the device, sync, and dashboard tests
import { expect } from "vitest";
import { createApp } from "../src/app";
import type { AuthUser } from "../src/types/deps";
import { MemoryDb } from "../src/database/memory";
import { callApi, readJson, type CallOptions, type TestApp } from "./harness";

export const USERS: Record<string, AuthUser> = {
  "token-a": { id: "user-a", email: "a@example.com", name: "Alice" },
  "token-b": { id: "user-b", email: "b@example.com", name: "Bob" },
};

export interface DeviceCodeBody {
  device_code: string;
  user_code: string;
  verification_uri_complete: string;
}

export interface DeviceTokenBody {
  device_token: string;
  device_id: string;
  project_id: string;
  error?: string;
}

export class ApiHarness {
  db = new MemoryDb();
  clock = Date.parse("2026-10-02T10:00:00Z");
  app: TestApp = createApp({
    serviceDb: this.db,
    // RLS is not simulated here; these tests prove the API's own owner filter
    userDb: () => this.db,
    verifyUser: async (token) => USERS[token] ?? null,
    appOrigin: "https://app.aevrin.net",
    now: () => new Date(this.clock),
  });

  call(method: string, path: string, opts: CallOptions = {}): Promise<Response> {
    return callApi(this.app, method, path, opts);
  }

  async callJson<T = Record<string, unknown>>(method: string, path: string, opts: CallOptions = {}): Promise<T> {
    return readJson<T>(await this.call(method, path, opts));
  }

  async signInDevice(user = "token-a", projectId: string | null = null): Promise<DeviceTokenBody> {
    const code = await this.callJson<DeviceCodeBody>("POST", "/device/code", { body: { name: "laptop", os: "Linux", engine_version: "0.0.1" } });
    const approve = await this.call("POST", "/device/approve", { token: user, body: { user_code: code.user_code, project_id: projectId } });
    expect(approve.status).toBe(200);
    this.clock += 6000;
    const issued = await this.callJson<DeviceTokenBody>("POST", "/device/token", { body: { device_code: code.device_code } });
    expect(issued.device_token).toMatch(/^mwd_/);
    return issued;
  }

  /** Put an account on Pro until 2027, as a verified payment would. Detail sync is a Pro feature. */
  async grantPro(token: string): Promise<void> {
    const owner = USERS[token].id;
    await this.db.table("subscriptions").upsert(
      { owner_id: owner, plan: "pro", status: "active", source: "admin", current_period_end: "2027-01-01T00:00:00Z", credit_paise: 0, bonus: {} },
      ["owner_id"],
    );
  }

  async setSync(token: string, sync: Record<string, boolean>): Promise<void> {
    // creates the profile row, as the signup trigger does in production
    await this.call("GET", "/me", { token });
    await this.grantPro(token);
    const res = await this.call("PATCH", "/settings", { token, body: { sync } });
    expect(res.status).toBe(200);
  }

  /** Every stored row as one string, to prove a value is stored nowhere. */
  everything(): string {
    return JSON.stringify([...this.db.tables.values()].map((table) => table.rows));
  }
}
