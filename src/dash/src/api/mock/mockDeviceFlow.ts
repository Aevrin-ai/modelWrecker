import type { DeviceApproval } from "../client";
import { delay } from "./mockMode";
import { buildApprovedDevice } from "./mockRecords";
import { mockState, mustFind, USER_CODE_RE } from "./mockState";

// a code can be used once, like the real API (409 already_used)
export async function approveMockDevice(userCode: string, projectId: string | null, approve: boolean): Promise<DeviceApproval> {
  const code = userCode.trim().toUpperCase();
  if (!USER_CODE_RE.test(code)) {
    await delay(undefined, 200);
    throw new Error("That code was not recognized. Check the code your engine shows and try again.");
  }
  if (mockState.usedCodes.has(code)) {
    await delay(undefined, 200);
    throw new Error("This code was already used. Run modelwrecker login again for a new one.");
  }
  mockState.usedCodes.add(code);
  if (!approve) return delay({ denied: true }, 300);
  const project = projectId ? mustFind(mockState.projects, projectId, "Project") : null;
  mockState.devices = [buildApprovedDevice(code, project), ...mockState.devices];
  return delay({ approved: true }, 400);
}
