// Tiny classnames joiner. Keeps deps minimal (no clsx/tailwind-merge needed).
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
