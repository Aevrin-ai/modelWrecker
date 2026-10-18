// the z score of a two-sided 95% confidence interval
const Z_95 = 1.959963984540054;


/** Wilson 95% interval, matching the engine's analytics (src/modelwrecker/reliability/replay.py). */
export function wilson(successes: number, trials: number): [number, number] {
  if (trials <= 0) return [0, 0];
  const zSquared = Z_95 * Z_95;
  const rate = successes / trials;
  const denom = 1 + zSquared / trials;
  const centre = rate + zSquared / (2 * trials);
  const margin = Z_95 * Math.sqrt((rate * (1 - rate)) / trials + zSquared / (4 * trials * trials));
  return [Math.max(0, (centre - margin) / denom), Math.min(1, (centre + margin) / denom)];
}
