import { useCallback, useLayoutEffect, useState, type RefObject } from "react";

import { STEPS } from "./steps";
import { PLACES, WIRES } from "./ring-places";
import { roundedPath, routeWire, type Box, type Point } from "./ring-geometry";

export type RingLayout = {
  width: number;
  height: number;
  wires: { d: string; ends: [Point, Point]; draw: readonly [number, number]; accent: boolean }[];
};

type NodeMap = Partial<Record<string, HTMLDivElement | null>>;

function measureRing(ringBox: HTMLDivElement, nodes: NodeMap): RingLayout | null {
  const boxes: Record<string, Box> = {};
  for (const step of STEPS) {
    const node = nodes[step.id];
    if (!node) return null;
    // offsets, not bounding boxes: the cards are scaled and tilted while they enter, and wires meet them at rest
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    const [placeX, placeY] = PLACES[step.id].at;
    const centerX = (placeX / 100) * ringBox.offsetWidth;
    const centerY = (placeY / 100) * ringBox.offsetHeight;
    boxes[step.id] = { x: centerX - width / 2, y: centerY - height / 2, w: width, h: height, cx: centerX, cy: centerY };
  }
  return {
    width: ringBox.offsetWidth,
    height: ringBox.offsetHeight,
    wires: WIRES.map((wire) => {
      const points = routeWire(wire.kind, boxes[wire.from], boxes[wire.to]);
      return { d: roundedPath(points), ends: [points[0], points[points.length - 1]], draw: wire.draw, accent: wire.accent };
    }),
  };
}

// each wire is routed from the measured size of its two cards, at any width and once the fonts have loaded
export function useRingLayout(boxRef: RefObject<HTMLDivElement | null>, nodeRefs: RefObject<NodeMap>) {
  const [layout, setLayout] = useState<RingLayout | null>(null);

  const measure = useCallback(() => {
    const ringBox = boxRef.current;
    if (!ringBox) return;
    const measured = measureRing(ringBox, nodeRefs.current);
    if (measured) setLayout(measured);
  }, [boxRef, nodeRefs]);

  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (boxRef.current) observer.observe(boxRef.current);
    // a card's width can change once the font it is set in has loaded
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
