import { useEffect, useState, type RefObject } from "react";

// where a target sits in a container, in percent, so the mockup cursor lands on a real control at any width
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
      const containerBox = container.getBoundingClientRect();
      const targetBox = target.getBoundingClientRect();
      if (containerBox.width === 0 || containerBox.height === 0) return;
      setPoint({
        x: ((targetBox.left + targetBox.width * 0.55 - containerBox.left) / containerBox.width) * 100,
        y: ((targetBox.top + targetBox.height * 0.6 - containerBox.top) / containerBox.height) * 100,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [containerRef, targetRef, key]);

  return point;
}
