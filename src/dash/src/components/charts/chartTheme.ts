// monochrome ink from the CSS design tokens, so charts match light and dark; severity is the only colored encoding
export const AXIS = "hsl(var(--muted-foreground))";
export const GRID = "hsl(var(--border))";
export const INK = "hsl(var(--chart-1))";
export const INK_2 = "hsl(var(--chart-4))";
export const SURFACE = "hsl(var(--card))";

export function formatChartDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
