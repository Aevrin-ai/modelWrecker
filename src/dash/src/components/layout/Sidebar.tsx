import { Link, NavLink } from "react-router-dom";
import { ChevronsUpDown, X } from "lucide-react";
import { NAV_GROUPS, NAV_ITEMS } from "@/lib/constants";
import { LogoLockup, LogoTile } from "@/components/Logo";
import { Avatar } from "@/components/ui/avatar";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { cn } from "@/lib/utils";

interface SidebarProps {
  /** Desktop icon-rail mode (3rem). Ignored in the mobile drawer. */
  collapsed: boolean;
  /** Mobile drawer: shows a close button, the project switcher, and labels always. */
  mobile?: boolean;
  onCloseMobile?: () => void;
}

/**
 * Sidebar measured from the reference: #fafafa surface, 1px right border, 16rem wide
 * expanded or a 3rem icon rail collapsed, 32px rounded-md items, zinc-100 active fill.
 */
export function Sidebar({ collapsed, mobile, onCloseMobile }: SidebarProps) {
  const showLabels = mobile || !collapsed;
  const { data: account } = useAsync(() => apiClient.getAccount(), []);

  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-linear",
        showLabels ? "w-[--sidebar-width]" : "w-[--sidebar-width-icon]",
        mobile && "w-72 max-w-[85vw]",
      )}
    >
      {/* Brand */}
      <div className="flex flex-col gap-2 p-2">
        <div className={cn("flex h-12 items-center gap-2 rounded-md p-2", !showLabels && "justify-center p-0")}>
          {showLabels ? (
            <Link to="/" onClick={onCloseMobile} className="min-w-0 flex-1">
              <LogoLockup />
            </Link>
          ) : (
            <Link to="/" title="Aevrin - Overview">
              <LogoTile />
            </Link>
          )}
          {mobile && onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="flex size-8 items-center justify-center rounded-md hover:bg-sidebar-accent"
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        {mobile && <ProjectSwitcher fullWidth />}
      </div>

      {/* Nav */}
      <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto no-scrollbar">
        {NAV_GROUPS.map((group) => (
          <div key={group} className="flex flex-col p-2 pt-0">
            {showLabels ? (
              <p className="flex h-8 shrink-0 items-center px-2 text-xs font-medium text-sidebar-foreground/70">
                {group}
              </p>
            ) : (
              <div className="mx-2 mb-2 h-px bg-sidebar-border first:hidden" />
            )}
            <ul className="flex flex-col gap-1">
              {NAV_ITEMS.filter((n) => n.group === group).map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    onClick={onCloseMobile}
                    title={!showLabels ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "flex h-8 items-center gap-2 overflow-hidden rounded-md p-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        !showLabels && "size-8 justify-center",
                        isActive
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" />
                    {showLabels && <span className="truncate">{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: signed-in user, like the reference */}
      <div className="p-2">
        <Link
          to="/account"
          onClick={onCloseMobile}
          title={!showLabels ? "Account" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-md p-2 transition-colors hover:bg-sidebar-accent",
            !showLabels && "justify-center p-0 py-2",
          )}
        >
          <Avatar initials={account?.avatarInitials ?? "--"} className="rounded-md" />
          {showLabels && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {account?.name ?? "Loading..."}
                </span>
                <span className="block truncate text-xs">{account?.email ?? ""}</span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0" />
            </>
          )}
        </Link>
      </div>
    </aside>
  );
}
