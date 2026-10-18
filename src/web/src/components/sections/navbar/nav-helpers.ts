export const NAV_TRIGGER_CLASS =
  "group text-foreground focus-visible:ring-ring flex items-center gap-1 rounded-full px-3.5 py-2 text-[15px] font-medium transition-[background-color,scale] duration-200 outline-none hover:bg-slate-950/[0.05] focus-visible:ring-2 active:scale-[0.97] dark:hover:bg-white/10";

export function isExternalHref(href: string) {
  return /^https?:/.test(href);
}

// solid while a menu is open, frosted once the page has scrolled, lighter at the very top
export function getIslandClassName(isOpen: boolean, isScrolled: boolean) {
  if (isOpen) {
    return "bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_32px_-14px_rgba(15,23,42,0.22)] ring-slate-900/[0.06] dark:bg-slate-950 dark:ring-white/10";
  }
  if (isScrolled) {
    return "bg-white/[0.68] ring-slate-900/[0.04] backdrop-blur-md dark:bg-slate-950/70 dark:ring-white/10";
  }
  return "bg-white/[0.62] ring-white/50 backdrop-blur-md dark:bg-slate-950/40 dark:ring-white/10";
}
