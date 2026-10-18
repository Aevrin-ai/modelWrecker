import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <Button variant="outline" className="w-full" onClick={() => void signOut()}>
      <LogOut /> Sign out
    </Button>
  );
}
