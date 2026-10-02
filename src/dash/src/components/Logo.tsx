import { cn } from "@/lib/utils";

/** The real Aevrin logo, served from public/ under the Vite base ("/dashboard/"). */
export const LOGO_SRC = `${import.meta.env.BASE_URL}aevrin-logo.png`;

/**
 * The Aevrin mark on a dark tile, the same treatment the reference uses for its brand
 * tile in the sidebar (rounded-md, primary ink background).
 */
export function LogoTile({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const box = size === "sm" ? "size-7" : size === "lg" ? "size-14" : "size-8";
  const img = size === "sm" ? "size-[1.15rem]" : size === "lg" ? "size-9" : "size-5";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-800",
        box,
        className,
      )}
    >
      <img src={LOGO_SRC} alt="Aevrin" className={cn("object-contain", img)} draggable={false} />
    </span>
  );
}

/** Tile + product name, for the sidebar header, drawer, and standalone pages. */
export function LogoLockup({ subtitle = "ModelWrecker console", className }: { subtitle?: string; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <LogoTile />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold text-foreground">Aevrin</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </span>
  );
}
