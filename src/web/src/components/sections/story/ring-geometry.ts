export type WireKind = "down" | "up" | "across" | "straight";
export type Point = [number, number];
export type Box = { x: number; y: number; w: number; h: number; cx: number; cy: number };

// every wire starts and ends this many pixels from a card
const GAP = 6;
const RADIUS = 16;

// a path through right-angled points, with each corner rounded
export function roundedPath(points: Point[]) {
  let pathData = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [prevX, prevY] = points[i - 1];
    const [cornerX, cornerY] = points[i];
    const [nextX, nextY] = points[i + 1];
    const cornerRadius = Math.min(
      RADIUS,
      Math.hypot(cornerX - prevX, cornerY - prevY) / 2,
      Math.hypot(nextX - cornerX, nextY - cornerY) / 2,
    );
    const inX = cornerX - Math.sign(cornerX - prevX) * cornerRadius;
    const inY = cornerY - Math.sign(cornerY - prevY) * cornerRadius;
    const outX = cornerX + Math.sign(nextX - cornerX) * cornerRadius;
    const outY = cornerY + Math.sign(nextY - cornerY) * cornerRadius;
    pathData += ` L ${inX} ${inY} Q ${cornerX} ${cornerY} ${outX} ${outY}`;
  }
  const [lastX, lastY] = points[points.length - 1];
  return `${pathData} L ${lastX} ${lastY}`;
}

// out of the bottom (down) or top (up) of one card, jog across halfway, into the next card
function routeVertical(kind: "down" | "up", from: Box, to: Box): Point[] {
  const start: Point = kind === "down" ? [from.cx, from.y + from.h + GAP] : [from.cx, from.y - GAP];
  const end: Point = kind === "down" ? [to.cx, to.y - GAP] : [to.cx, to.y + to.h + GAP];
  const mid = (start[1] + end[1]) / 2;
  return [start, [from.cx, mid], [to.cx, mid], end];
}

// bends sit halfway between the two mirrored centres, so the left half of the ring mirrors the right
export function routeWire(kind: WireKind, from: Box, to: Box): Point[] {
  const toRight = to.cx > from.cx;
  const side = (box: Box, right: boolean) => (right ? box.x + box.w + GAP : box.x - GAP);
  const midX = (from.cx + to.cx) / 2;
  if (kind === "across") {
    return [
      [side(from, toRight), from.cy],
      [midX, from.cy],
      [midX, to.cy],
      [side(to, !toRight), to.cy],
    ];
  }
  if (kind === "down" || kind === "up") return routeVertical(kind, from, to);
  return [
    [side(from, toRight), from.cy],
    [side(to, !toRight), to.cy],
  ];
}
