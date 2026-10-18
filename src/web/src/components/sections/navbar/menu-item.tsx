import type { FocusEvent, PointerEvent } from "react";
import { Link } from "react-router";

import type { NavItem } from "@/data/nav";
import { isExternalHref } from "./nav-helpers";

const MENU_ITEM_CLASS =
  "relative z-10 flex items-center gap-3.5 rounded-xl px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface MenuItemProps {
  item: NavItem;
  onDone: () => void;
  onHover: (event: PointerEvent | FocusEvent) => void;
}

// one entry in a panel: an icon in a soft square, a name, and a line about it
export function MenuItem({ item, onDone, onHover }: MenuItemProps) {
  const Icon = item.icon;
  const body = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-950/[0.06] dark:bg-white/10">
        <Icon className="size-[22px] text-slate-700 dark:text-slate-300" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 text-left">
        <span className="text-foreground text-[15px] font-semibold">{item.title}</span>
        <span className="text-muted-foreground text-[13px]">{item.description}</span>
      </span>
    </>
  );
  const events = { onPointerEnter: onHover, onFocus: onHover };
  if (isExternalHref(item.href)) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={MENU_ITEM_CLASS} onClick={onDone} {...events}>
        {body}
      </a>
    );
  }
  return (
    <Link to={item.href} className={MENU_ITEM_CLASS} onClick={onDone} {...events}>
      {body}
    </Link>
  );
}
