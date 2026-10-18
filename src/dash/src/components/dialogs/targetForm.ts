import type { TargetType } from "@/types";

export interface TargetForm {
  name: string;
  type: TargetType;
  provider: string;
  endpoint: string;
  model: string;
  projectId: string;
  authorized: boolean;
}

export type SetTargetField = <K extends keyof TargetForm>(key: K, value: TargetForm[K]) => void;

export function emptyTargetForm(projectId: string): TargetForm {
  return { name: "", type: "chat", provider: "", endpoint: "", model: "", projectId, authorized: false };
}
