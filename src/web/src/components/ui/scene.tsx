import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// scenery painted in CSS (.scene-* in index.css): nothing to download, and hidden from assistive technology
export type SceneName = "sky" | "meadow" | "dusk" | "mist" | "glass";

export interface SceneProps {
  name: SceneName;
  className?: string;
}

export function Scene({ name, className }: SceneProps) {
  return <div aria-hidden="true" className={cn("scene", `scene-${name}`, className)} />;
}

export interface PaintedPanelProps {
  scene: SceneName;
  className?: string;
  children: ReactNode;
}

// a rounded window onto a scene, with a piece of the product standing in front of it
export function PaintedPanel({ scene, className, children }: PaintedPanelProps) {
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
