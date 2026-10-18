// z for a 95% confidence level
const Z_95 = 1.96;

// the 95% Wilson score interval for successCount wins in tryCount tries, as fractions: (7, 10) -> about 0.40 to 0.89
export function wilsonInterval(successCount: number, tryCount: number) {
  const rate = successCount / tryCount;
  const zSquared = Z_95 * Z_95;
  const denominator = 1 + zSquared / tryCount;
  const centre = (rate + zSquared / (2 * tryCount)) / denominator;
  const halfWidth = (Z_95 * Math.sqrt((rate * (1 - rate)) / tryCount + zSquared / (4 * tryCount * tryCount))) / denominator;
  return { lo: Math.max(0, centre - halfWidth), hi: Math.min(1, centre + halfWidth) };
}
