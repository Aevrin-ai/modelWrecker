import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Link, useLocation } from "react-router";

import { cn } from "@/lib/utils";
import { APP_URL, DEMO_URL } from "@/lib/links";
import { useTheme } from "@/hooks/use-theme";
import { barLinks, menus, type NavColumn, type NavItem } from "@/data/nav";
import { Logo } from "@/components/ui/logo";
import { Pill } from "@/components/ui/pill";
import {
  AltArrowDownLine,
  AltArrowRightLine,
  CloseCircleLine,
  HamburgerMenuLine,
  Moon,
  Sun,
} from "@/components/ui/solar-icons";

/*
  The navigation bar: one floating rounded island. A menu opens inside the
  island itself, below a hairline, so the bar and its panel read as one surface
  that grows rather than a dropdown hanging off it. Its height is measured and
  eased (380ms), so moving between menus morphs the panel instead of jumping.
  Panels open on hover with a mouse, and on click or Enter otherwise; the phone
  menu opens the same way from the menu button. The bar slips away while you
  scroll down and comes back the moment you scroll up.
*/

const TRIGGER =
  "group text-foreground focus-visible:ring-ring flex items-center gap-1 rounded-full px-3.5 py-2 text-[15px] font-medium transition-[background-color,scale] duration-200 outline-none hover:bg-slate-950/[0.05] focus-visible:ring-2 active:scale-[0.97] dark:hover:bg-white/10";

const isExternal = (href: string) => /^https?:/.test(href);

// One entry in a panel: an icon in a soft square, a name, and a line about it.
function MenuItem({ item, onDone, onHover }: { item: NavItem; onDone: () => void; onHover: (e: PointerEvent | React.FocusEvent) => void }) {
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
  const className =
    "relative z-10 flex items-center gap-3.5 rounded-xl px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const events = { onPointerEnter: onHover, onFocus: onHover };
  if (isExternal(item.href)) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={className} onClick={onDone} {...events}>
        {body}
      </a>
    );
  }
  return (
    <Link to={item.href} className={className} onClick={onDone} {...events}>
      {body}
    </Link>
  );
}

/*
  The columns of a panel, with one soft highlight behind them that slides to
  whichever item the pointer or keyboard is on, rather than each item lighting
  up on its own.
*/
function Columns({ columns, onDone, stacked = false }: { columns: NavColumn[]; onDone: () => void; stacked?: boolean }) {
  const surface = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<{ left: number; top: number; width: number; height: number; hidden?: boolean } | null>(null);

  const hover = (event: PointerEvent | React.FocusEvent) => {
    const el = event.currentTarget as HTMLElement;
    const box = surface.current!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setSpot({ left: r.left - box.left, top: r.top - box.top, width: r.width, height: r.height });
  };

  return (
    <div
      ref={surface}
      onPointerLeave={() => setSpot((s) => s && { ...s, hidden: true })}
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
                <MenuItem item={item} onDone={onDone} onHover={hover} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/*
  One menu on a phone: a row that opens in place to show its items, the way
  Activepieces folds its menus, so the phone menu stays short.
*/
function MobileSection({ label, columns, onDone }: { label: string; columns: NavColumn[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const id = `nav-mobile-${label.toLowerCase()}`;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="text-foreground focus-visible:ring-ring flex min-h-12 w-full items-center justify-between rounded-lg px-1 text-base font-medium outline-none focus-visible:ring-2"
      >
        {label}
        <AltArrowRightLine className={cn("size-4 transition-transform duration-200", open && "rotate-90")} />
      </button>
      <div
        id={id}
        inert={!open}
        className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-1 pb-3">
            <Columns columns={columns} onDone={onDone} stacked />
          </div>
        </div>
      </div>
    </div>
  );
}

// Down hides the bar, any move up brings it back. Never hidden near the top.
function useHideOnScroll(locked: boolean) {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      if (Math.abs(y - last) < 4) return;
      setHidden(y > last && y > 120);
      last = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return { hidden: hidden && !locked, scrolled };
}

export function Navbar() {
  const { theme, toggle } = useTheme();
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const location = useLocation();
  const island = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState<string | null>(null);
  const { hidden, scrolled } = useHideOnScroll(open !== null);

  // Anything that moves to another page or section closes the menu behind it.
  const here = location.pathname + location.hash;
  const [lastPath, setLastPath] = useState(here);
  if (here !== lastPath) {
    setLastPath(here);
    setOpen(null);
  }

  const close = useCallback(() => setOpen(null), []);

  // Opened with the down arrow: once the panel is in the page, focus its first item.
  const focusFirst = useRef(false);
  useEffect(() => {
    if (!focusFirst.current || !open) return;
    focusFirst.current = false;
    document.querySelector<HTMLElement>("#nav-panel a")?.focus();
  }, [open]);

  // Escape and a click anywhere outside the island close it too.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(null);
    const onDown = (event: globalThis.PointerEvent) => !island.current?.contains(event.target as Node) && setOpen(null);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  // The phone menu locks the page behind it.
  useEffect(() => {
    if (open !== "mobile") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Hovering opens a panel at once; leaving the island waits a moment, so a
  // pointer cutting a corner on its way into the panel does not shut it.
  const hoverOpen = (id: string) => (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    clearTimeout(closeTimer.current);
    setOpen(id);
  };
  const hoverLeave = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || open === "mobile") return;
    closeTimer.current = setTimeout(() => setOpen(null), 160);
  };
  const hoverStay = () => clearTimeout(closeTimer.current);

  // What the panel shows. It keeps the last menu while the panel closes, so
  // the contents fade out with it rather than vanishing before it shrinks.
  const [shown, setShown] = useState<string | null>(null);
  if (open && open !== shown) setShown(open);
  const menu = menus.find((m) => m.id === shown);

  // The panel's height follows its contents, measured, so it can ease between
  // menus of different sizes instead of jumping.
  const contents = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = contents.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 pt-3 transition-[translate] duration-300 ease-(--ease-smooth) md:pt-4"
      style={{ translate: hidden ? "0 calc(-100% - 1rem)" : "0 0" }}
    >
      <div className="max-w-container">
        <div
          ref={island}
          onPointerLeave={hoverLeave}
          onPointerEnter={hoverStay}
          className={cn(
            "overflow-hidden rounded-2xl ring-1 transition-[background-color,box-shadow] duration-300 ease-out",
            open
              ? "bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_32px_-14px_rgba(15,23,42,0.22)] ring-slate-900/[0.06] dark:bg-slate-950 dark:ring-white/10"
              : scrolled
                ? "bg-white/[0.68] ring-slate-900/[0.04] backdrop-blur-md dark:bg-slate-950/70 dark:ring-white/10"
                : "bg-white/[0.62] ring-white/50 backdrop-blur-md dark:bg-slate-950/40 dark:ring-white/10",
          )}
        >
          <nav
            aria-label="Main"
            className="flex h-16 items-center justify-between gap-3 px-4 md:h-[68px] md:px-6 lg:grid lg:grid-cols-[1fr_auto_1fr]"
          >
            <Link to="/" aria-label="modelWrecker home" className="flex min-h-11 items-center justify-self-start rounded-lg">
              <Logo />
            </Link>

            <ul className="hidden items-center gap-1 justify-self-center lg:flex">
              {menus.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    aria-expanded={open === m.id}
                    aria-controls="nav-panel"
                    onPointerEnter={hoverOpen(m.id)}
                    onClick={() => setOpen((current) => (current === m.id ? null : m.id))}
                    onKeyDown={(event) => {
                      // Down arrow opens the menu and moves into it, so the
                      // keyboard need not tab past the rest of the bar first.
                      if (event.key !== "ArrowDown") return;
                      event.preventDefault();
                      focusFirst.current = true;
                      setOpen(m.id);
                    }}
                    className={cn(TRIGGER, open === m.id && "bg-slate-950/[0.05] dark:bg-white/10")}
                  >
                    {m.label}
                    <AltArrowDownLine
                      className={cn("-mr-0.5 size-4 transition-transform duration-200 ease-out", open === m.id && "rotate-180")}
                    />
                  </button>
                </li>
              ))}
              {barLinks.map((link) => (
                <li key={link.href}>
                  {isExternal(link.href) ? (
                    <a href={link.href} target="_blank" rel="noreferrer" className={TRIGGER} onPointerEnter={() => setOpen(null)}>
                      {link.label}
                    </a>
                  ) : (
                    <Link to={link.href} className={TRIGGER} onPointerEnter={() => setOpen(null)}>
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2 justify-self-end">
              <button
                type="button"
                onClick={toggle}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="text-foreground focus-visible:ring-ring hidden size-9 items-center justify-center rounded-full transition-colors outline-none hover:bg-slate-950/[0.06] focus-visible:ring-2 lg:flex dark:hover:bg-white/10"
              >
                <ThemeIcon className="size-[18px]" />
              </button>
              <Pill variant="outline" size="sm" href={APP_URL} className="hidden md:inline-flex">
                Open modelWrecker
              </Pill>
              <Pill size="sm" href={DEMO_URL} className="hidden pr-3 sm:inline-flex">
                Request a demo
                <AltArrowRightLine className="-mr-1 transition-transform group-hover:translate-x-0.5" />
              </Pill>
              <button
                type="button"
                aria-expanded={open === "mobile"}
                aria-controls="nav-panel"
                aria-label={open === "mobile" ? "Close menu" : "Open menu"}
                onClick={() => setOpen((current) => (current === "mobile" ? null : "mobile"))}
                className="text-foreground focus-visible:ring-ring flex size-10 items-center justify-center rounded-full outline-none hover:bg-slate-950/[0.06] focus-visible:ring-2 lg:hidden dark:hover:bg-white/10"
              >
                {open === "mobile" ? <CloseCircleLine className="size-6" /> : <HamburgerMenuLine className="size-5" />}
              </button>
            </div>
          </nav>

          {/* The panel grows out of the bar. Its height eases to fit whatever
              it holds; the contents settle in as it opens and fade as it closes. */}
          <div
            id="nav-panel"
            inert={!open}
            className="overflow-hidden"
            style={{
              height: open ? height : 0,
              opacity: open ? 1 : 0,
              transition: reduce ? "none" : "height 380ms var(--ease-smooth), opacity 240ms var(--ease-smooth)",
            }}
          >
            <div ref={contents}>
              {shown && (
                <div key={shown} className="nav-panel-in mx-4 border-t border-slate-950/[0.08] pt-4 pb-6 md:mx-6 dark:border-white/10">
                  {shown === "mobile" ? (
                    <div className="max-h-[calc(100svh-120px)] overflow-y-auto">
                      {menus.map((m) => (
                        <MobileSection key={m.id} label={m.label} columns={m.columns} onDone={close} />
                      ))}
                      <div className="mt-2 flex flex-col gap-1 border-t border-slate-950/[0.08] pt-4 dark:border-white/10">
                        {barLinks.map((link) =>
                          isExternal(link.href) ? (
                            <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="text-foreground px-1 py-2 text-base font-medium">
                              {link.label}
                            </a>
                          ) : (
                            <Link key={link.href} to={link.href} onClick={close} className="text-foreground px-1 py-2 text-base font-medium">
                              {link.label}
                            </Link>
                          ),
                        )}
                        <div className="mt-3 flex flex-col gap-2">
                          <Pill href={DEMO_URL} className="w-full">
                            Request a demo
                          </Pill>
                          <Pill variant="outline" href={APP_URL} className="w-full">
                            Open modelWrecker
                          </Pill>
                          <Pill variant="soft" onClick={toggle} className="w-full">
                            <ThemeIcon />
                            {theme === "dark" ? "Light mode" : "Dark mode"}
                          </Pill>
                        </div>
                      </div>
                    </div>
                  ) : (
                    menu && <Columns columns={menu.columns} onDone={close} />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
