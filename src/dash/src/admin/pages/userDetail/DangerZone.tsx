import { Ban, KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserDetail as Detail } from "../../client";

export interface DangerZoneProps {
  user: Detail;
  onAction: (kind: "suspend" | "reset-mfa" | "delete") => void;
}

export function DangerZone({ user, onAction }: DangerZoneProps) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Account access</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => onAction("suspend")}>
          <Ban /> {user.suspendedAt ? "Restore access" : "Suspend"}
        </Button>
        {user.isStaff && user.staffMfaEnrolled && (
          <Button variant="outline" onClick={() => onAction("reset-mfa")}>
            <KeyRound /> Reset authenticator
          </Button>
        )}
        {!user.isStaff && (
          <Button variant="destructive" onClick={() => onAction("delete")}>
            <Trash2 /> Delete user
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
