import { STEPS, type Step } from "./steps";
import type { WireKind } from "./ring-geometry";

type Place = { at: [number, number]; tilt: number; enter: ["scale", number] | ["blur"] };

// where each step sits (percent of the ring box), its entry tilt, and whether it pops up or rises out of a blur
export const PLACES: Record<Step["id"], Place> = {
  campaign: { at: [12, 17.5], tilt: -2, enter: ["scale", 0.62] },
  planner: { at: [8.8, 50], tilt: 1.5, enter: ["scale", 0.96] },
  strategies: { at: [13, 82.5], tilt: 2, enter: ["scale", 0.86] },
  target: { at: [31, 92.5], tilt: -1, enter: ["blur"] },
  judge: { at: [50, 92.5], tilt: 0, enter: ["scale", 0.86] },
  replay: { at: [69, 92.5], tilt: 1, enter: ["blur"] },
  finding: { at: [87, 82.5], tilt: -2, enter: ["scale", 0.86] },
  evidence: { at: [91.2, 50], tilt: -1.5, enter: ["scale", 0.96] },
  report: { at: [88, 17.5], tilt: 2, enter: ["scale", 0.62] },
};

// down the left, across the corner, along the bottom, across the other corner, up the right
const KINDS: WireKind[] = ["down", "down", "across", "straight", "straight", "across", "up", "up"];

// the wires grow in run order and each step appears as its wire reaches it
const WIRE_START = 0.655;
const WIRE_STEP = 0.022;
const WIRE_FOR = 0.036;
// one lime wire on each side, mirrored
const ACCENT = new Set([1, 6]);

export const WIRES = KINDS.map((kind, i) => {
  const drawStart = WIRE_START + i * WIRE_STEP;
  return {
    from: STEPS[i].id,
    to: STEPS[i + 1].id,
    kind,
    draw: [drawStart, drawStart + WIRE_FOR] as const,
    accent: ACCENT.has(i),
  };
});

export const SHOW = STEPS.map((_, i) => (i === 0 ? WIRE_START - 0.012 : WIRES[i - 1].draw[1] - 0.012));
