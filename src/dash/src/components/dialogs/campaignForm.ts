import type { Campaign } from "@/types";

export interface CampaignForm {
  name: string;
  projectId: string;
  targetId: string;
  strategies: string[];
  objectiveCount: number;
  stopCondition: Campaign["stopCondition"];
  concurrency: number;
  maxAttempts: number | null;
}

export type SetCampaignField = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => void;

export function emptyCampaignForm(projectId: string, targetId: string): CampaignForm {
  return {
    name: "",
    projectId,
    targetId,
    strategies: [],
    objectiveCount: 6,
    stopCondition: "complete",
    concurrency: 2,
    maxAttempts: 300,
  };
}
