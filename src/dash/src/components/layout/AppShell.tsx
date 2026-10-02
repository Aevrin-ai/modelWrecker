import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const COLLAPSE_KEY = "aevrin-sidebar-collapsed";

/**
 * Shell: a full-width header on top, the sidebar beneath it on the left, and the page in a
 * scrolling main column (reference padding: 16px mobile, 20px top / 32px sides desktop).
 * Below 1024px the sidebar becomes a drawer opened from the header toggle.
 */
export function AppShell() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  function toggleSidebar() {
    if (!isDesktop) {
      setMobileOpen((o) => !o);
      return;
    }
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[80] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-popover"
      >
        Skip to content
      </a>
      <Header onToggleSidebar={toggleSidebar} />

      <div className="flex min-h-0 flex-1">
        {isDesktop && (
          <div className="shrink-0">
            <Sidebar collapsed={collapsed} />
          </div>
        )}

        <main id="main" className="min-w-0 flex-1 overflow-y-auto">
          <div key={location.pathname} className="mx-auto w-full max-w-[1400px] animate-fade-in p-4 pb-10 lg:px-8 lg:pt-5">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile / tablet drawer */}
      {!isDesktop && mobileOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/80 animate-fade-in" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full animate-fade-in">
            <Sidebar collapsed={false} mobile onCloseMobile={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
