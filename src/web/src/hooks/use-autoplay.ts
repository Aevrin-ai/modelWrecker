import { useCallback, useEffect, useState, type RefObject } from "react";
import { useInView, useReducedMotion } from "motion/react";

/*
  Steps a mockup through its phases, one timer at a time.

  `durations[n]` is how long phase n holds, in seconds, before the next one.
  The timer only runs while the mockup is on screen, so a page of mockups is
  not a page of animation loops working in the background.

  Once someone picks a phase by hand, autoplay stops: a demo that keeps
  advancing under your cursor is fighting you. `restart` hands control back.

  Under reduced motion the mockup opens on its last phase, the one that
  carries the result, and never advances on its own.
*/
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
  // Bumped by restart so the timer re-arms even when phase was already 0.
  const [run, setRun] = useState(0);

  const playing = !reduce && !touched && inView;

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      setPhaseRaw((p) => (p >= last ? (loop ? 0 : p) : p + 1));
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
    setRun((r) => r + 1);
  }, []);

  return { phase: reduce && !touched ? last : phase, setPhase, restart, playing };
}
