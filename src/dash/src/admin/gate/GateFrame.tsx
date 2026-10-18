import type { ReactNode } from "react";
import { AuthFrame } from "@/pages/SignIn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LOGO_SRC } from "@/components/Logo";

export interface GateFrameProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function GateFrame({ title, icon, children }: GateFrameProps) {
  return (
    <AuthFrame>
      <div className="flex flex-col items-center gap-3 pb-6">
        <span className="flex size-12 items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-800">
          <img src={LOGO_SRC} alt="Aevrin" className="size-8 object-contain" draggable={false} />
        </span>
        <span className="text-sm font-semibold tracking-tight">Aevrin admin</span>
      </div>
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </AuthFrame>
  );
}
