export const CAMPAIGN = 0;
export const PLAN = 1;
export const SEND = 2;
export const JUDGE = 3;
export const REPLAY = 4;
export const FINDING = 5;

// how far a timed part is: done once its phase is past, and done at once for anyone who asked for less motion
export function getPartProgress(phase: number, part: number, typed: number, isReducedMotion: boolean | null): number {
  if (phase > part || (phase === part && isReducedMotion)) return 1;
  if (phase === part) return typed;
  return 0;
}
