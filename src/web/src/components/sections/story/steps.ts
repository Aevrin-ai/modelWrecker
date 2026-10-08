import {
  Chart,
  DocumentText,
  FileText,
  Layers,
  RefreshCircle,
  Scale,
  ShieldWarning,
  Target,
  Tuning,
  type IconComponent,
} from "@/components/ui/solar-icons";

// The nine steps of one run, in the order they happen. The ring and the chip
// grid both read this list, so they always agree.
export type StepId =
  | "campaign"
  | "planner"
  | "strategies"
  | "target"
  | "judge"
  | "replay"
  | "finding"
  | "evidence"
  | "report";

export type Step = { id: StepId; label: string; icon: IconComponent };

export const STEPS: Step[] = [
  { id: "campaign", label: "Campaign", icon: FileText },
  { id: "planner", label: "Planner", icon: Tuning },
  { id: "strategies", label: "Strategies", icon: Layers },
  { id: "target", label: "Target", icon: Target },
  { id: "judge", label: "Judge", icon: Scale },
  { id: "replay", label: "Replay", icon: RefreshCircle },
  { id: "finding", label: "Finding", icon: ShieldWarning },
  { id: "evidence", label: "Evidence", icon: DocumentText },
  { id: "report", label: "Report", icon: Chart },
];
