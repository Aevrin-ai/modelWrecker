import type { Database, Row } from "../types/deps";
import { firstRow } from "../database/firstRow";
import { namedQueries } from "../database/namedQueries";

// each status change matches the old status too, so two concurrent requests cannot both make it
export function deviceAuthRequestsRepository(db: Database) {
  const requests = db.table("device_auth_requests");
  return namedQueries("deviceAuthRequests", {
    findByUserCode: (userCode: string): Promise<Row | null> => firstRow(requests.select({ eq: { user_code: userCode } })),
    findByDeviceCodeHash: (hash: string): Promise<Row | null> => firstRow(requests.select({ eq: { device_code_hash: hash } })),
    insert: (row: Row): Promise<Row> => requests.insert(row),
    deny: (id: string, owner: string): Promise<Row[]> =>
      requests.update({ id, status: "pending" }, { status: "denied", owner_id: owner }),
    approve: async (id: string, owner: string, projectId: string): Promise<boolean> => {
      const updated = await requests.update({ id, status: "pending" }, { status: "approved", owner_id: owner, project_id: projectId });
      return updated.length === 1;
    },
    recordPoll: (id: string, polledAt: string): Promise<Row[]> => requests.update({ id }, { last_polled_at: polledAt }),
    consume: async (id: string): Promise<boolean> => {
      const claimed = await requests.update({ id, status: "approved" }, { status: "consumed" });
      return claimed.length === 1;
    },
    linkDevice: (id: string, deviceId: string): Promise<Row[]> => requests.update({ id }, { device_id: deviceId }),
  });
}
