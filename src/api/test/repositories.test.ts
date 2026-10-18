import { describe, expect, it } from "vitest";
import { MemoryDb } from "../src/database/memory";
import { namedQueries } from "../src/database/namedQueries";
import { DbError } from "../src/lib/errors";
import { errorFields } from "../src/lib/log";
import { billingEventsRepository } from "../src/repositories/billingEvents";
import { campaignsRepository } from "../src/repositories/campaigns";
import { deviceAuthRequestsRepository } from "../src/repositories/deviceAuthRequests";
import { ownedRowsRepository } from "../src/repositories/ownedRows";
import { paymentsRepository } from "../src/repositories/payments";
import { profilesRepository } from "../src/repositories/profiles";

describe("named queries", () => {
  it("names the failed query on a database error, so the log says which one broke", async () => {
    const repository = namedQueries("profiles", {
      findById: async (): Promise<null> => {
        throw new DbError("connection reset", "08006");
      },
    });
    const err = await repository.findById().catch((thrown: unknown) => thrown);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).operation).toBe("profiles.findById");
    expect(errorFields(err)).toMatchObject({ errorName: "DbError", operation: "profiles.findById" });
  });

  it("keeps the innermost name when one query calls another", async () => {
    const inner = namedQueries("payments", {
      fulfil: async (): Promise<null> => {
        throw new DbError("deadlock", "40P01");
      },
    });
    const outer = namedQueries("billing", { checkout: () => inner.fulfil() });
    const err = await outer.checkout().catch((thrown: unknown) => thrown);
    expect((err as DbError).operation).toBe("payments.fulfil");
  });

  it("passes any other error through untouched", async () => {
    const repository = namedQueries("profiles", {
      findById: async (): Promise<null> => {
        throw new TypeError("not a database error");
      },
    });
    const err = await repository.findById().catch((thrown: unknown) => thrown);
    expect(err).toBeInstanceOf(TypeError);
    expect(errorFields(err)).toEqual({ errorName: "TypeError", errorMessage: "not a database error" });
  });
});

describe("repositories on the in-memory database", () => {
  it("returns null, not an empty list, when a row is missing", async () => {
    expect(await profilesRepository(new MemoryDb()).findById("nobody")).toBeNull();
  });

  it("never returns another account's row by id", async () => {
    const db = new MemoryDb();
    const project = await db.table("projects").insert({ owner_id: "alice", name: "Payments bot" });
    const projects = ownedRowsRepository(db, "projects");
    expect(await projects.findForOwner(String(project.id), "mallory")).toBeNull();
    expect(await projects.findForOwner(String(project.id), "alice")).toMatchObject({ name: "Payments bot" });
  });

  it("approves a device sign-in once, and lets its token be claimed once", async () => {
    const db = new MemoryDb();
    const request = await db.table("device_auth_requests").insert({ user_code: "ABCD-EFGH", device_code_hash: "h1", status: "pending" });
    const requests = deviceAuthRequestsRepository(db);
    const id = String(request.id);
    expect(await requests.approve(id, "alice", "project-1")).toBe(true);
    expect(await requests.approve(id, "mallory", "project-2")).toBe(false);
    expect(await requests.consume(id)).toBe(true);
    expect(await requests.consume(id)).toBe(false);
  });

  it("moves a campaign only from the status it is expected to be in", async () => {
    const db = new MemoryDb();
    const campaign = await db.table("campaigns").insert({ owner_id: "alice", name: "Weekly", status: "draft" });
    const campaigns = campaignsRepository(db);
    expect(await campaigns.moveForOwner(String(campaign.id), "alice", "running", "paused")).toBeNull();
    expect(await campaigns.moveForOwner(String(campaign.id), "alice", "draft", "running")).toMatchObject({ status: "running" });
  });

  it("marks only an open order as failed, never a paid one", async () => {
    const db = new MemoryDb();
    const paid = await db.table("payments").insert({ owner_id: "alice", razorpay_order_id: "order_1", status: "paid" });
    await paymentsRepository(db).markFailed(String(paid.id));
    expect(await paymentsRepository(db).findByOrderId("order_1")).toMatchObject({ status: "paid" });
  });

  it("remembers which webhook events were already applied", async () => {
    const events = billingEventsRepository(new MemoryDb());
    expect(await events.exists("evt_1")).toBe(false);
    await events.insert("evt_1", "payment.captured");
    expect(await events.exists("evt_1")).toBe(true);
  });
});
