import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// merges Tailwind class names safely (shadcn convention)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
