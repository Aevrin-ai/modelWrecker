import { useRef, useState, type FocusEvent, type PointerEvent } from "react";

import { cn } from "@/lib/utils";
import type { NavColumn } from "@/data/nav";
import { MenuItem } from "./menu-item";

type Highlight = { left: number; top: number; width: number; height: number; hidden?: boolean };

export interface MenuColumnsProps {
  columns: NavColumn[];
  onDone: () => void;
  stacked?: boolean;
}

// one soft highlight slides to the hovered or focused item instead of each item lighting up on its own
export function MenuColumns({ columns, onDone, stacked = false }: MenuColumnsProps) {
  const surface = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<Highlight | null>(null);

  const handleHover = (event: PointerEvent | FocusEvent) => {
    const item = event.currentTarget as HTMLElement;
    const surfaceBox = surface.current!.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    setSpot({
      left: itemBox.left - surfaceBox.left,
      top: itemBox.top - surfaceBox.top,
      width: itemBox.width,
      height: itemBox.height,
    });
  };

  return (
    <div
      ref={surface}
      onPointerLeave={() => setSpot((current) => current && { ...current, hidden: true })}
      className={cn("relative -mx-3 flex gap-5", stacked && "flex-col gap-4")}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute rounded-xl bg-slate-950/[0.05] dark:bg-white/[0.07]"
        style={{
          left: spot?.left ?? 0,
          top: spot?.top ?? 0,
          width: spot?.width ?? 0,
          height: spot?.height ?? 0,
          opacity: spot && !spot.hidden ? 1 : 0,
          scale: spot && !spot.hidden ? 1 : 0.96,
          transition:
            "opacity 130ms ease, scale 130ms ease, left 220ms var(--ease-smooth), top 220ms var(--ease-smooth), width 220ms var(--ease-smooth), height 220ms var(--ease-smooth)",
        }}
      />
      {columns.map((column) => (
        <div key={column.heading} className="min-w-0 flex-1">
          <p className="text-muted-foreground px-3 pb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">{column.heading}</p>
          <ul className="flex flex-col gap-1">
            {column.items.map((item) => (
              <li key={item.title}>
                <MenuItem item={item} onDone={onDone} onHover={handleHover} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
