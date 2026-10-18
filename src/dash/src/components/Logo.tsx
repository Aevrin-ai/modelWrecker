import { cn } from "@/lib/utils";

// served from public/ under the Vite base ("/dashboard/")
export const LOGO_SRC = `${import.meta.env.BASE_URL}aevrin-logo.png`;

type LogoSize = "sm" | "md" | "lg";

const TILE_CLASS: Record<LogoSize, { box: string; image: string }> = {
  sm: { box: "size-7", image: "size-[1.15rem]" },
  md: { box: "size-8", image: "size-5" },
  lg: { box: "size-14", image: "size-9" },
};

export interface LogoTileProps {
  size?: LogoSize;
  className?: string;
}

export function LogoTile({ size = "md", className }: LogoTileProps) {
  const { box, image } = TILE_CLASS[size];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-800",
        box,
        className,
      )}
    >
      <img src={LOGO_SRC} alt="Aevrin" className={cn("object-contain", image)} draggable={false} />
    </span>
  );
}

export interface LogoLockupProps {
  subtitle?: string;
  className?: string;
}

// tile plus product name, for the sidebar header, drawer, and standalone pages
export function LogoLockup({ subtitle = "ModelWrecker console", className }: LogoLockupProps) {
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
