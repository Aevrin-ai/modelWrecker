import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { BarChart3, CreditCard, Globe, Lock, LogOut, Menu, Moon, ScrollText, Sun, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LogoTile } from "@/components/Logo";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { adminClient } from "./client";

const NAV: { to: string; label: string; icon: LucideIcon; group: string }[] = [
  { to: "/users", label: "Users", icon: Users, group: "Manage" },
  { to: "/payments", label: "Payments", icon: CreditCard, group: "Manage" },
  { to: "/audit", label: "Audit log", icon: ScrollText, group: "Manage" },
  { to: "/analytics", label: "Platform analytics", icon: BarChart3, group: "Insights" },
  { to: "/traffic", label: "Page analytics", icon: Globe, group: "Insights" },
];

const ICON_BTN = "flex size-9 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground";

/** The admin console's frame: the dashboard's look, with its own navigation and a staff badge. */
export function AdminShell() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { user, signOut } = useAuth();

  useEffect(() => setOpen(false), [location.pathname]);

  async function lock() {
    await adminClient.endSession().catch(() => undefined);
    window.dispatchEvent(new Event("aevrin-admin-session-ended"));
  }

  const nav = (
    <aside className="flex h-full w-[--sidebar-width] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground" aria-label="Admin navigation">
      <div className="flex h-12 items-center gap-2 p-4">
        <LogoTile />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-semibold">Aevrin</p>
          <p className="text-xs text-sidebar-foreground/70">Admin console</p>
        </div>
        {!isDesktop && (
          <button type="button" className={cn(ICON_BTN, "size-8")} onClick={() => setOpen(false)} aria-label="Close navigation">
            <X className="size-4" />
          </button>
        )}
      </div>
      <nav className="mt-4 flex flex-1 flex-col gap-2 overflow-y-auto">
        {["Manage", "Insights"].map((group) => (
          <div key={group} className="flex flex-col p-2 pt-0">
            <p className="flex h-8 items-center px-2 text-xs font-medium text-sidebar-foreground/70">{group}</p>
            <ul className="flex flex-col gap-1">
              {NAV.filter((n) => n.group === group).map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex h-8 items-center gap-2 rounded-md p-2 text-sm transition-colors",
                        isActive ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="space-y-1 p-3 text-xs text-sidebar-foreground/70">
        <p className="truncate">{user?.email ?? "ops@aevrin.net"}</p>
        <a href="/dashboard/" className="underline underline-offset-4">
          Open the dashboard
        </a>
      </div>
    </aside>
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <header className="flex h-header shrink-0 items-center gap-2 border-b bg-background px-3">
        {!isDesktop && (
          <button type="button" className={cn(ICON_BTN, "size-8")} onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu className="size-4" />
          </button>
        )}
        <Badge tone="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">Staff only</Badge>
        <p className="hidden text-sm text-muted-foreground sm:block">Every change is recorded in the audit log.</p>
        <div className="flex-1" />
        <button type="button" onClick={toggle} className={ICON_BTN} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="size-[1.15rem]" /> : <Moon className="size-[1.15rem]" />}
        </button>
        <button type="button" onClick={() => void lock()} className={ICON_BTN} title="End admin session" aria-label="End admin session">
          <Lock className="size-[1.15rem]" />
        </button>
        <button
          type="button"
          onClick={() => {
            void adminClient.endSession().catch(() => undefined);
            void signOut();
          }}
          className={ICON_BTN}
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="size-[1.15rem]" />
        </button>
      </header>
      <div className="flex min-h-0 flex-1">
        {isDesktop && <div className="shrink-0">{nav}</div>}
        <main id="main" className="min-w-0 flex-1 overflow-y-auto">
          <div key={location.pathname} className="mx-auto w-full max-w-[1400px] animate-fade-in p-4 pb-10 lg:px-8 lg:pt-5">
            <Outlet />
          </div>
        </main>
      </div>
      {!isDesktop && open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/80" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full">{nav}</div>
        </div>
      )}
    </div>
  );
}
