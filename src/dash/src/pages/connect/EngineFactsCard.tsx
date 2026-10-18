import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoTile } from "@/components/Logo";

export function EngineFactsCard() {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <LogoTile />
        <div>
          <CardTitle>ModelWrecker engine</CardTitle>
          <CardDescription>The compute plane, on your machine</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {[
          "Non-root container, read-only root filesystem",
          "No Docker socket, SSH keys, or home folder mounted",
          "Only ./config (read-only) and ./runs are shared",
          "CPU, memory, and process limits set in compose",
        ].map((fact) => (
          <p key={fact} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0" /> {fact}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}
