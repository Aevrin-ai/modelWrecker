import { Link } from "react-router-dom";
import { AlertTriangle, Bell, CheckCircle2, CreditCard, Download, MonitorSmartphone, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Dropdown, DropdownSeparator } from "@/components/ui/dropdown";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/types";
import { ICON_BTN } from "./headerStyles";

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

export interface NotificationsMenuProps {
  notifications: NotificationItem[] | null;
  unread: number;
}

export function NotificationsMenu({ notifications, unread }: NotificationsMenuProps) {
  return (
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
            {(notifications ?? []).map((notification) => {
              const Icon = NOTIF_ICON[notification.kind];
              const inner = (
                <div className="flex gap-3">
                  <Icon className={cn("mt-0.5 size-4 shrink-0", NOTIF_TONE[notification.kind])} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm", !notification.read && "font-medium")}>{notification.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
                    <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{relativeTime(notification.at)}</p>
                  </div>
                  {!notification.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                </div>
              );
              return notification.href ? (
                <Link
                  key={notification.id}
                  to={notification.href}
                  onClick={close}
                  className="block rounded-sm px-2 py-2 transition-colors hover:bg-accent"
                >
                  {inner}
                </Link>
              ) : (
                <div key={notification.id} className="px-2 py-2">
                  {inner}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Dropdown>
  );
}
