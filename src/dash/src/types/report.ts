// formats the engine's `analyze` command writes as static files
export type ReportFormat = "html" | "json" | "csv";

export interface Report {
  id: string;
  name: string;
  runId: string; // the local run directory, runs/<run-id>
  projectId: string;
  projectName: string;
  campaignId: string | null;
  campaignName: string | null;
  kind: "campaign" | "analytics" | "leaderboard";
  formats: ReportFormat[];
  // "cloud" can be exported from the dashboard; "local" means the file lives on the device
  availability: "cloud" | "local";
  findingCount: number;
  generatedAt: string;
  sizeBytes: number;
}
