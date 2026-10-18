import type { ComponentType } from "react";

import {
  AgentTaskWindow,
  ApiRequestWindow,
  CustomerTableWindow,
  DocumentSearchWindow,
  McpToolsWindow,
  SupportChatWindow,
  SystemPromptWindow,
} from "./windows";

export type WindowSpot = {
  Comp: ComponentType;
  at: [number, number];
  tilt: number;
  from: [number, number, number];
  start: number;
  front: boolean;
};

// rest spot (stage %), tilt, fly-in origin (vw, vh, tilt) and start; the first three sit behind the words
export const WINDOWS: WindowSpot[] = [
  { Comp: SystemPromptWindow, at: [50, 32], tilt: 2, from: [0, -115, 4], start: 0.3, front: false },
  { Comp: CustomerTableWindow, at: [22, 34], tilt: -4, from: [-115, -31, -8], start: 0.312, front: false },
  { Comp: McpToolsWindow, at: [78, 34], tilt: 3, from: [115, -42, 6], start: 0.33, front: false },
  { Comp: ApiRequestWindow, at: [21, 71], tilt: 5, from: [-89, 63, 10], start: 0.345, front: true },
  { Comp: SupportChatWindow, at: [39, 66], tilt: -2, from: [-26, 100, -4], start: 0.37, front: true },
  { Comp: DocumentSearchWindow, at: [68, 59], tilt: 6, from: [73, 13, 12], start: 0.35, front: true },
  { Comp: AgentTaskWindow, at: [79, 70], tilt: -5, from: [73, 58, -10], start: 0.385, front: true },
];
