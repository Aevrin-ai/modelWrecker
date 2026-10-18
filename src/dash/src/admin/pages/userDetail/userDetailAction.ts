import type { UserDetail as Detail } from "../../client";

export type UserAction =
  | { kind: "plan" }
  | { kind: "bonus" }
  | { kind: "credit" }
  | { kind: "sync" }
  | { kind: "rename" }
  | { kind: "suspend" }
  | { kind: "reset-mfa" }
  | { kind: "delete" }
  | { kind: "refund"; paymentId: string; number: string; amount: number }
  | { kind: "revoke"; deviceId: string; name: string }
  | null;

export interface UserDialogProps {
  user: Detail;
  open: boolean;
  onClose: () => void;
  onDone: (title: string) => void;
}

export const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

// end of the chosen day in UTC, so "paid until 31 Dec" includes all of 31 Dec
export const endOfDay = (date: string) => (date ? new Date(`${date}T23:59:59Z`).toISOString() : null);
