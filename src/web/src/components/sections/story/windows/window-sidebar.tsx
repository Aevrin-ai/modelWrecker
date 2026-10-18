import { cn } from "@/lib/utils";

export interface WindowSidebarProps {
  items: string[];
  active?: number;
}

export function WindowSidebar({ items, active = 0 }: WindowSidebarProps) {
  return (
    <div className="w-[170px] shrink-0 space-y-1 border-r border-slate-900/[0.08] bg-slate-50/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
      {items.map((item, i) => (
        <p
          key={item}
          className={cn(
            "rounded-lg px-3 py-1.5 text-[14px]",
            i === active
              ? "bg-white font-medium text-slate-900 shadow-xs dark:bg-white/10 dark:text-white"
              : "text-slate-500 dark:text-slate-400",
          )}
        >
          {item}
        </p>
      ))}
    </div>
  );
}
