import { Loader2 } from "lucide-react";
import { AuthFrame } from "./AuthFrame";
import { BrandLockup } from "./BrandLockup";

// shown in http mode while the stored session or the Google callback is read
export function AuthLoading() {
  return (
    <AuthFrame>
      <div className="flex flex-col items-center gap-6">
        <BrandLockup />
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" /> Checking your session...
        </p>
      </div>
    </AuthFrame>
  );
}
