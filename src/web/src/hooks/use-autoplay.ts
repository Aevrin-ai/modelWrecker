import { useCallback, useEffect, useState, type RefObject } from "react";
import { useInView, useReducedMotion } from "motion/react";

function getNextPhase(current: number, last: number, loop: boolean) {
  if (current < last) return current + 1;
  return loop ? 0 : current;
}

// `durations[n]` is how long phase n holds in seconds; it plays only on screen and stops once a phase is picked
export function useAutoplay(
  ref: RefObject<Element | null>,
  durations: readonly number[],
  { loop = true, amount = 0.35 }: { loop?: boolean; amount?: number } = {},
) {
  const reduce = useReducedMotion();
  const inView = useInView(ref, { amount });
  const last = durations.length - 1;

  const [phase, setPhaseRaw] = useState(0);
  const [touched, setTouched] = useState(false);
  // bumped by restart so the timer re-arms even when phase was already 0
  const [run, setRun] = useState(0);

  const playing = !reduce && !touched && inView;

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      setPhaseRaw((current) => getNextPhase(current, last, loop));
    }, durations[phase] * 1000);
    return () => clearTimeout(timer);
  }, [playing, phase, last, loop, durations, run]);

  const setPhase = useCallback((next: number) => {
    setTouched(true);
    setPhaseRaw(next);
  }, []);

  const restart = useCallback(() => {
    setTouched(false);
    setPhaseRaw(0);
    setRun((count) => count + 1);
  }, []);

  // under reduced motion it rests on the last phase, the one that carries the result
  return { phase: reduce && !touched ? last : phase, setPhase, restart, playing };
}
