import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
  The scenery behind the hero, the product panels and the close of the page:
  skies, haze and hills painted in CSS (see .scene-* in index.css). No photos,
  nothing to download. Scenery only, so it is hidden from assistive technology.
*/
export type SceneName = "sky" | "meadow" | "dusk" | "mist" | "glass";

export function Scene({ name, className }: { name: SceneName; className?: string }) {
  return <div aria-hidden="true" className={cn("scene", `scene-${name}`, className)} />;
}

// A rounded window onto a scene, with a piece of the product standing in front of it.
export function PaintedPanel({ scene, className, children }: { scene: SceneName; className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[32px] ring-1 ring-slate-900/5 dark:ring-white/10",
        "shadow-[0_0_0_1px_rgb(2_6_23/0.06),0_2px_4px_-2px_rgb(2_6_23/0.08),0_8px_16px_-6px_rgb(2_6_23/0.08)]",
        className,
      )}
    >
      <Scene name={scene} />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
