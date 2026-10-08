import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { easeOut, motion, useTransform, type MotionValue } from "motion/react";

import { STEPS, type Step } from "./steps";

/*
  What the windows collapse into: the nine steps of one run, laid out as a U
  around the words. A run starts top left with the campaign, goes down the
  left, across the bottom and up the right to the report, so the first and
  last steps mirror each other and the ring stays symmetrical without
  implying a loop the run does not have. The wires grow in the order a run
  happens. Each
  wire is routed from the measured size of the two cards it joins, so it
  always starts and ends 6px from a card, with a dot at each end, at any
  screen width and once the fonts have loaded. Wide screens only.
*/

type Kind = "down" | "up" | "across" | "straight";

// Where each step sits (percent of the ring box), its slight tilt while it
// enters, and how it enters: popping up from smaller, or rising out of a blur.
// The left side mirrors the right.
const PLACES: Record<Step["id"], { at: [number, number]; tilt: number; enter: ["scale", number] | ["blur"] }> = {
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

// How each wire leaves one step for the next: down the left, across the bottom
// corner, straight along the bottom, across the other corner, and up the right.
const KINDS: Kind[] = ["down", "down", "across", "straight", "straight", "across", "up", "up"];

// The wires grow one after another, Campaign to Planner first and Evidence to
// Report last; each step appears as its wire reaches it.
const WIRE_START = 0.655;
const WIRE_STEP = 0.022;
const WIRE_FOR = 0.036;
// One lime wire on each side, mirrored.
const ACCENT = new Set([1, 6]);

const WIRES = KINDS.map((kind, i) => {
  const a = WIRE_START + i * WIRE_STEP;
  return { from: STEPS[i].id, to: STEPS[i + 1].id, kind, draw: [a, a + WIRE_FOR] as const, accent: ACCENT.has(i) };
});

const SHOW = STEPS.map((_, i) => (i === 0 ? WIRE_START - 0.012 : WIRES[i - 1].draw[1] - 0.012));

const GAP = 6;
const RADIUS = 16;

type Point = [number, number];
type Box = { x: number; y: number; w: number; h: number; cx: number; cy: number };

// A path through right-angled points, with each corner rounded.
function rounded(points: Point[]) {
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const r = Math.min(RADIUS, Math.hypot(cx - px, cy - py) / 2, Math.hypot(nx - cx, ny - cy) / 2);
    const inX = cx - Math.sign(cx - px) * r;
    const inY = cy - Math.sign(cy - py) * r;
    const outX = cx + Math.sign(nx - cx) * r;
    const outY = cy + Math.sign(ny - cy) * r;
    d += ` L ${inX} ${inY} Q ${cx} ${cy} ${outX} ${outY}`;
  }
  const [lx, ly] = points[points.length - 1];
  return `${d} L ${lx} ${ly}`;
}

// The points for one wire, from the boxes of the two steps it joins. Bends sit
// halfway between the two centres, which are placed in mirror image, so the
// left half of the ring mirrors the right.
function route(kind: Kind, a: Box, b: Box): Point[] {
  const toRight = b.cx > a.cx;
  const side = (box: Box, right: boolean) => (right ? box.x + box.w + GAP : box.x - GAP);
  const midX = (a.cx + b.cx) / 2;
  if (kind === "across") {
    // Out of the side of one, along, a step up or down, into the side of the next.
    return [
      [side(a, toRight), a.cy],
      [midX, a.cy],
      [midX, b.cy],
      [side(b, !toRight), b.cy],
    ];
  }
  if (kind === "down") {
    // Out of the bottom of one, jog across halfway, into the top of the next.
    const start: Point = [a.cx, a.y + a.h + GAP];
    const end: Point = [b.cx, b.y - GAP];
    const mid = (start[1] + end[1]) / 2;
    return [start, [a.cx, mid], [b.cx, mid], end];
  }
  if (kind === "up") {
    // Out of the top of one, jog across halfway, into the bottom of the next.
    const start: Point = [a.cx, a.y - GAP];
    const end: Point = [b.cx, b.y + b.h + GAP];
    const mid = (start[1] + end[1]) / 2;
    return [start, [a.cx, mid], [b.cx, mid], end];
  }
  return [
    [side(a, toRight), a.cy],
    [side(b, !toRight), b.cy],
  ];
}

type Layout = {
  width: number;
  height: number;
  wires: { d: string; ends: [Point, Point]; draw: readonly [number, number]; accent: boolean }[];
};

function useRing(boxRef: RefObject<HTMLDivElement | null>, nodeRefs: RefObject<Partial<Record<string, HTMLDivElement | null>>>) {
  const [layout, setLayout] = useState<Layout | null>(null);

  const measure = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    const boxes: Record<string, Box> = {};
    for (const step of STEPS) {
      const el = nodeRefs.current[step.id];
      if (!el) return;
      // Offsets, not bounding boxes: the cards are scaled and tilted while
      // they enter, and the wires must meet them where they come to rest.
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const [px, py] = PLACES[step.id].at;
      const cx = (px / 100) * box.offsetWidth;
      const cy = (py / 100) * box.offsetHeight;
      boxes[step.id] = { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy };
    }
    setLayout({
      width: box.offsetWidth,
      height: box.offsetHeight,
      wires: WIRES.map((wire) => {
        const points = route(wire.kind, boxes[wire.from], boxes[wire.to]);
        return { d: rounded(points), ends: [points[0], points[points.length - 1]], draw: wire.draw, accent: wire.accent };
      }),
    });
  }, [boxRef, nodeRefs]);

  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (boxRef.current) observer.observe(boxRef.current);
    // A card's width can change once the font it is set in has loaded.
    let live = true;
    document.fonts?.ready.then(() => {
      if (live) measure();
    });
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [boxRef, measure]);

  return layout;
}

function Wire({ wire, progress }: { wire: Layout["wires"][number]; progress: MotionValue<number> }) {
  const [a, b] = wire.draw;
  const length = useTransform(progress, [a, b], [0, 1]);
  const startDot = useTransform(progress, [a, a + 0.005], [0, 1]);
  const endDot = useTransform(progress, [b - 0.005, b], [0, 1]);
  const [start, end] = wire.ends;
  return (
    <>
      <motion.path
        d={wire.d}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        className={wire.accent ? "stroke-lime" : "stroke-slate-300 dark:stroke-white/20"}
        style={{ pathLength: length }}
      />
      <motion.circle cx={start[0]} cy={start[1]} r="3" className="fill-slate-900 dark:fill-white" style={{ opacity: startDot }} />
      <motion.circle cx={end[0]} cy={end[1]} r="3" className="fill-slate-900 dark:fill-white" style={{ opacity: endDot }} />
    </>
  );
}

// One step: an icon and its name on a small white card. Every card has the
// same least width, so mirrored cards match and so do their wires.
function NodeCard({ step }: { step: Step }) {
  const Icon = step.icon;
  return (
    <div className="flex min-w-36 items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-3 whitespace-nowrap ring-1 ring-slate-900/10 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_6px_16px_-10px_rgba(15,23,42,0.25)] xl:min-w-[10.5rem] dark:bg-slate-900 dark:ring-white/10">
      <Icon aria-hidden="true" className="text-brand size-5 shrink-0" />
      <span className="text-foreground text-[15px] leading-none xl:text-[17px]">{step.label}</span>
    </div>
  );
}

function RingNode({
  step,
  show,
  progress,
  nodeRef,
}: {
  step: Step;
  show: number;
  progress: MotionValue<number>;
  nodeRef: (el: HTMLDivElement | null) => void;
}) {
  const { at, tilt, enter } = PLACES[step.id];
  const during = [show, show + 0.035];
  const blur = enter[0] === "blur";
  const opacity = useTransform(progress, during, [0, 1]);
  const scale = useTransform(progress, during, [enter[0] === "scale" ? enter[1] : 1, 1], { ease: easeOut });
  const y = useTransform(progress, during, [blur ? 20 : 0, 0], { ease: easeOut });
  const rotate = useTransform(progress, during, [tilt, 0], { ease: easeOut });
  const filter = useTransform(progress, during, [blur ? "blur(4px)" : "blur(0px)", "blur(0px)"]);
  return (
    // A point with no size where the card rests, so it scales about its centre.
    <motion.div className="absolute size-0" style={{ left: `${at[0]}%`, top: `${at[1]}%`, opacity, scale, y, rotate, filter }}>
      <div ref={nodeRef} className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2">
        <NodeCard step={step} />
      </div>
    </motion.div>
  );
}

export function Ring({ progress }: { progress: MotionValue<number> }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Partial<Record<string, HTMLDivElement | null>>>({});
  const layout = useRing(boxRef, nodeRefs);
  return (
    <div ref={boxRef} aria-hidden="true" className="absolute inset-x-0 top-[14%] bottom-[4.5%] hidden lg:block">
      {layout && (
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="absolute inset-0 size-full overflow-visible"
          focusable="false"
        >
          {layout.wires.map((wire, i) => (
            <Wire key={i} wire={wire} progress={progress} />
          ))}
        </svg>
      )}
      {STEPS.map((step, i) => (
        <RingNode
          key={step.id}
          step={step}
          show={SHOW[i]}
          progress={progress}
          nodeRef={(el) => {
            nodeRefs.current[step.id] = el;
          }}
        />
      ))}
    </div>
  );
}
