import { cn } from "@/lib/utils";

interface AvatarProps {
  initials: string;
  className?: string;
}

/** Initials avatar in the brand tint. */
export function Avatar({ initials, className }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 select-none items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}
