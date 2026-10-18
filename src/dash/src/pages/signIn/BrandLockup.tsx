import { LOGO_SRC } from "@/components/Logo";

export function BrandLockup() {
  return (
    <div className="flex items-center justify-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-800">
        <img src={LOGO_SRC} alt="" className="size-6 object-contain" draggable={false} />
      </span>
      <span className="text-lg font-semibold tracking-tight">Aevrin</span>
    </div>
  );
}
