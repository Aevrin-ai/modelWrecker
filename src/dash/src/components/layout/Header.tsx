import { Link } from "react-router-dom";
import {
  Bell,
  LogOut,
  Moon,
  Settings,
  Sun,
  UserCircle,
  AlertTriangle,
  CheckCircle2,
  MonitorSmartphone,
  RefreshCw,
  Download,
  PanelLeft,
  CreditCard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown, DropdownItem, DropdownLabel, DropdownLinkItem, DropdownSeparator } from "@/components/ui/dropdown";
import { LogoTile } from "@/components/Logo";
import { GlobalSearch } from "./GlobalSearch";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/types";

const NOTIF_ICON: Record<NotificationItem["kind"], LucideIcon> = {
  campaign_completed: CheckCircle2,
  critical_finding: AlertTriangle,
  device_connected: MonitorSmartphone,
  device_disconnected: MonitorSmartphone,
  sync_failed: RefreshCw,
  new_version: Download,
  subscription_changed: CreditCard,
};

const NOTIF_TONE: Record<NotificationItem["kind"], string> = {
  campaign_completed: "text-success",
  critical_finding: "text-destructive",
  device_connected: "text-success",
  device_disconnected: "text-muted-foreground",
  sync_failed: "text-warning",
  new_version: "text-foreground",
  subscription_changed: "text-foreground",
};

const ICON_BTN =
  "flex size-9 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground";

/**
 * Full-width top bar measured from the reference: 56px tall, 1px bottom border, sidebar
 * toggle at the far left, a 32px search field, then ghost icon buttons on the right with
 * a dark count badge on notifications, a divider, and sign out.
 */
export function Header({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { theme, toggle } = useTheme();
  const { signOut } = useAuth();
  const { data: notifications } = useAsync(() => apiClient.listNotifications(), []);
  const { data: account } = useAsync(() => apiClient.getAccount(), []);
  const unread = (notifications ?? []).filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-40 flex h-header w-full shrink-0 items-center gap-2 border-b bg-background px-2 sm:gap-3">
      <button type="button" onClick={onToggleSidebar} className={cn(ICON_BTN, "size-8")} aria-label="Toggle navigation">
        <PanelLeft className="size-4" />
      </button>
      <div className="hidden h-4 w-px bg-border sm:block" />

      <Link to="/" className="lg:hidden" aria-label="Aevrin overview">
        <LogoTile size="sm" />
      </Link>

      <div className="min-w-0 flex-1 sm:max-w-xs md:max-w-sm">
        <GlobalSearch />
      </div>
      <div className="hidden md:block">
        <ProjectSwitcher />
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <button type="button" onClick={toggle} className={cn(ICON_BTN, "hidden sm:flex")} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="size-[1.15rem]" /> : <Moon className="size-[1.15rem]" />}
        </button>

        {/* Notifications */}
        <Dropdown
          label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          panelClassName="w-[min(20rem,calc(100vw-1rem))]"
          trigger={
            <span className={cn(ICON_BTN, "relative")}>
              <Bell className="size-[1.15rem]" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-1 flex size-5 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                  {unread}
                </span>
              )}
            </span>
          }
        >
          {(close) => (
            <>
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm font-semibold">Notifications</span>
                {unread > 0 && <span className="text-xs text-muted-foreground">{unread} unread</span>}
              </div>
              <DropdownSeparator />
              <div className="max-h-96 overflow-y-auto">
                {(notifications ?? []).length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">You are all caught up.</p>
                )}
                {(notifications ?? []).map((n) => {
                  const Icon = NOTIF_ICON[n.kind];
                  const inner = (
                    <div className="flex gap-3">
                      <Icon className={cn("mt-0.5 size-4 shrink-0", NOTIF_TONE[n.kind])} />
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm", !n.read && "font-medium")}>{n.title}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                        <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{relativeTime(n.at)}</p>
                      </div>
                      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                  );
                  return n.href ? (
                    <Link
                      key={n.id}
                      to={n.href}
                      onClick={close}
                      className="block rounded-sm px-2 py-2 transition-colors hover:bg-accent"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={n.id} className="px-2 py-2">
                      {inner}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Dropdown>

        {/* User menu */}
        <Dropdown
          label="Account menu"
          panelClassName="w-56"
          trigger={
            <span className={ICON_BTN}>
              <Avatar initials={account?.avatarInitials ?? "--"} className="size-7 text-[0.65rem]" />
            </span>
          }
        >
          {(close) => (
            <>
              <div className="px-2 py-1.5">
                <p className="truncate text-sm font-medium">{account?.name ?? "Loading..."}</p>
                <p className="truncate text-xs text-muted-foreground">{account?.email}</p>
              </div>
              <DropdownSeparator />
              <DropdownLabel>{account?.organization}</DropdownLabel>
              <DropdownLinkItem to="/account" onClick={close}>
                  <UserCircle className="size-4 text-muted-foreground" />
                  Account
                </DropdownLinkItem>
              <DropdownLinkItem to="/settings" onClick={close}>
                  <Settings className="size-4 text-muted-foreground" />
                  Settings
                </DropdownLinkItem>
              <DropdownLinkItem to="/billing" onClick={close}>
                  <CreditCard className="size-4 text-muted-foreground" />
                  Billing
                </DropdownLinkItem>
              <DropdownItem
                className="sm:hidden"
                onClick={() => {
                  toggle();
                  close();
                }}
              >
                {theme === "dark" ? <Sun className="size-4 text-muted-foreground" /> : <Moon className="size-4 text-muted-foreground" />}
                {theme === "dark" ? "Light theme" : "Dark theme"}
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem
                onClick={() => {
                  close();
                  void signOut();
                }}
                className="text-destructive hover:text-destructive"
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownItem>
            </>
          )}
        </Dropdown>

        <div className="hidden h-6 w-px bg-border sm:block" />
        <button
          type="button"
          onClick={() => void signOut()}
          className={cn(ICON_BTN, "hidden sm:flex")}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-[1.15rem]" />
        </button>
      </div>
    </header>
  );
}
