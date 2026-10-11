import { useEffect, useState, type RefObject } from "react";

/*
  Where a target element sits inside a container, as percentages, so the
  mockup cursor lands on a real control at any width instead of on a guessed
  coordinate that drifts as the layout reflows.
*/
export function useAnchorPoint(
  containerRef: RefObject<HTMLElement | null>,
  targetRef: RefObject<HTMLElement | null>,
  key: unknown,
) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const target = targetRef.current;
      if (!container || !target) return;
      const c = container.getBoundingClientRect();
      const t = target.getBoundingClientRect();
      if (c.width === 0 || c.height === 0) return;
      setPoint({
        x: ((t.left + t.width * 0.55 - c.left) / c.width) * 100,
        y: ((t.top + t.height * 0.6 - c.top) / c.height) * 100,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [containerRef, targetRef, key]);

  return point;
}
