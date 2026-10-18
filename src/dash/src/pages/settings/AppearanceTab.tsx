import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/field";

export interface AppearanceTabProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export function AppearanceTab({ theme, onToggleTheme }: AppearanceTabProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Stored in this browser only.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <span className="text-sm">Dark mode</span>
          <Switch label="Dark mode" checked={theme === "dark"} onCheckedChange={onToggleTheme} />
        </CardContent>
      </Card>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="size-3.5" /> Account and sign-in details are on the <Link to="/account" className="underline">Account</Link> page.
      </p>
    </>
  );
}
