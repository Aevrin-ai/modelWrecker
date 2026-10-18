import type { ReactNode } from "react";

import { WindowDots } from "@/components/mockups/kit";
import type { IconComponent } from "@/components/ui/solar-icons";

// every window is drawn at 680 by 480, about an app window on a laptop, and the stage scales it
const WINDOW_WIDTH = 680;
const WINDOW_HEIGHT = 480;

export interface WindowFrameProps {
  title: string;
  icon: IconComponent;
  children: ReactNode;
}

export function WindowFrame({ title, icon: Icon, children }: WindowFrameProps) {
  return (
    <div
      className="shadow-float flex flex-col overflow-hidden rounded-[20px] bg-white text-slate-900 ring-1 ring-slate-900/10 dark:bg-slate-900 dark:text-slate-100 dark:ring-white/10"
      style={{ width: WINDOW_WIDTH, height: WINDOW_HEIGHT }}
    >
      <div className="flex h-12 shrink-0 items-center gap-4 border-b border-slate-900/[0.08] bg-slate-50 px-5 dark:border-white/[0.08] dark:bg-white/[0.03]">
        <WindowDots className="gap-2 text-[12px]" />
        <span className="mx-auto flex h-7 w-[52%] items-center justify-center gap-2 rounded-lg bg-white text-[14px] font-medium text-slate-600 ring-1 ring-slate-900/[0.06] dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/[0.06]">
          <Icon className="size-4 text-slate-500 dark:text-slate-400" />
          {title}
        </span>
        <span className="w-[52px]" />
      </div>
      <div className="flex min-h-0 flex-1">{children}</div>
    </div>
  );
}
