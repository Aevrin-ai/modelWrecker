import { CreditCard, LogOut, Moon, Settings, Sun, UserCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown, DropdownItem, DropdownLabel, DropdownLinkItem, DropdownSeparator } from "@/components/ui/dropdown";
import type { Account } from "@/types";
import { ICON_BTN } from "./headerStyles";

export interface AccountMenuProps {
  account: Account | null;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onSignOut: () => Promise<void>;
}

export function AccountMenu({ account, theme, onToggleTheme, onSignOut }: AccountMenuProps) {
  return (
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
              onToggleTheme();
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
              void onSignOut();
            }}
            className="text-destructive hover:text-destructive"
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownItem>
        </>
      )}
    </Dropdown>
  );
}
