import { Link } from "react-router";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useTheme } from "@/hooks/use-theme";
import { Logo } from "@/components/ui/logo";
import { DesktopMenu } from "./desktop-menu";
import { NavActions } from "./nav-actions";
import { NavPanel } from "./nav-panel";
import { getIslandClassName } from "./nav-helpers";
import { useNavMenu } from "./use-nav-menu";
import { useNavPanel } from "./use-nav-panel";

// one floating island whose menu opens inside it, so the bar and its panel read as one growing surface
export function Navbar() {
  const { theme, toggle } = useTheme();
  const isReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { island, open, close, toggleMenu, openWithKeyboard, hoverOpen, hoverLeave, hoverStay, hidden, scrolled } =
    useNavMenu();
  const { shown, menu, contentsRef, height } = useNavPanel(open);

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
            getIslandClassName(Boolean(open), scrolled),
          )}
        >
          <nav
            aria-label="Main"
            className="flex h-16 items-center justify-between gap-3 px-4 md:h-[68px] md:px-6 lg:grid lg:grid-cols-[1fr_auto_1fr]"
          >
            <Link to="/" aria-label="modelWrecker home" className="flex min-h-11 items-center justify-self-start rounded-lg">
              <Logo />
            </Link>
            <DesktopMenu
              openMenu={open}
              onHoverOpen={hoverOpen}
              onToggle={toggleMenu}
              onKeyboardOpen={openWithKeyboard}
              onClose={close}
            />
            <NavActions
              theme={theme}
              onToggleTheme={toggle}
              isMobileOpen={open === "mobile"}
              onToggleMobile={() => toggleMenu("mobile")}
            />
          </nav>
          <NavPanel
            openMenu={open}
            shown={shown}
            menu={menu}
            height={height}
            contentsRef={contentsRef}
            isReducedMotion={isReducedMotion}
            onClose={close}
            theme={theme}
            onToggleTheme={toggle}
          />
        </div>
      </div>
    </header>
  );
}
