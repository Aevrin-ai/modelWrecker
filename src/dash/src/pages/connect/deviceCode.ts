import { ApiError } from "@/api";

// a device user code: 8 characters shown as XXXX-XXXX
export const USER_CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

// "wdjb mjht" -> "WDJB-MJHT": uppercase, letters and digits only, a dash after the fourth
export function formatUserCode(raw: string): string {
  const chars = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return chars.length > 4 ? `${chars.slice(0, 4)}-${chars.slice(4)}` : chars;
}

// clear text for the contract's device-approval error codes; otherwise the API's safe message
export function approvalErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "unknown_code") return "That code was not recognized. Check the code your engine shows and try again.";
    if (err.code === "expired_token") return "This code has expired. Run modelwrecker login again for a new one.";
    if (err.code === "already_used") return "This code was already used. Run modelwrecker login again for a new one.";
    return err.message;
  }
  return err instanceof Error && err.message ? err.message : "The approval did not go through. Try again.";
}

export type LinkState =
  | { kind: "idle" }
  | { kind: "busy"; approve: boolean }
  | { kind: "approved" }
  | { kind: "denied" }
  | { kind: "error"; message: string };
