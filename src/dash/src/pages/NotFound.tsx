import { Link } from "react-router-dom";
import { buttonClasses } from "@/components/ui/button";
import { LogoTile } from "@/components/Logo";

export function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <LogoTile size="lg" />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="text-sm text-muted-foreground">This page does not exist, or you do not have access to it.</p>
      </div>
      <Link to="/" className={buttonClasses("default")}>
        Back to overview
      </Link>
    </div>
  );
}
