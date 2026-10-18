import { Link } from "react-router-dom";
import { LogOut, Moon, PanelLeft, Sun } from "lucide-react";
import { LogoTile } from "@/components/Logo";
import { AccountMenu } from "./AccountMenu";
import { GlobalSearch } from "./GlobalSearch";
import { ICON_BTN } from "./headerStyles";
import { NotificationsMenu } from "./NotificationsMenu";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { theme, toggle } = useTheme();
  const { signOut } = useAuth();
  const { data: notifications } = useAsync(() => apiClient.listNotifications(), []);
  const { data: account } = useAsync(() => apiClient.getAccount(), []);
  const unread = (notifications ?? []).filter((notification) => !notification.read).length;

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

        <NotificationsMenu notifications={notifications} unread={unread} />
        <AccountMenu account={account} theme={theme} onToggleTheme={toggle} onSignOut={signOut} />

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
