import { useRef } from "react";

import { cn } from "@/lib/utils";
import { useAutoplay } from "@/hooks/use-autoplay";
import { Bolt, Lock, Scale, Target, type IconComponent } from "@/components/ui/solar-icons";
import { AppCard, Tag, Tile } from "./kit";

const ROLES: { name: string; text: string; model: string; icon: IconComponent }[] = [
  { name: "Attacker", text: "Picks and changes the attacks.", model: "Model 1", icon: Bolt },
  { name: "Target", text: "The AI being tested.", model: "Model 2", icon: Target },
  { name: "Judge", text: "Decides what worked.", model: "Model 3", icon: Scale },
];
// each role lights in turn; the last holds before it starts again
const ROLE_STEPS = [1.6, 1.6, 3.2] as const;

// a wall between two roles: a striped bar with a lock in the middle
function Wall() {
  return (
    <div className="relative flex h-7 items-center px-2">
      <span className="h-2.5 flex-1 rounded-full bg-[repeating-linear-gradient(135deg,rgb(15_23_42/0.22)_0_5px,transparent_5px_10px)] dark:bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.22)_0_5px,transparent_5px_10px)]" />
      <span className="absolute left-1/2 grid size-7 -translate-x-1/2 place-items-center rounded-full bg-white ring-1 ring-slate-900/10 dark:bg-slate-800 dark:ring-white/15">
        <Lock className="size-4 text-slate-600 dark:text-slate-300" />
      </span>
    </div>
  );
}

// the three model roles, with walls between them
export function RolesMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase } = useAutoplay(ref, ROLE_STEPS);
  return (
    <div ref={ref} className="h-full">
      <AppCard
        className="flex h-full flex-col justify-center p-4 sm:p-5"
        label="Three separate models with walls between them: the attacker picks and changes the attacks, the target is the AI being tested, and the judge decides what worked."
      >
        {ROLES.map((role, i) => (
          <div key={role.name}>
            {i > 0 && <Wall />}
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 ring-1 transition-[box-shadow,background-color] duration-500 dark:bg-white/[0.04]",
                phase === i ? "bg-lime/15 ring-lime ring-2 dark:bg-lime/10" : "ring-slate-900/10 dark:ring-white/10",
              )}
            >
              <Tile icon={role.icon} className="bg-white dark:bg-white/10" />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold">{role.name}</span>
                <span className="block text-[14px] text-slate-600 dark:text-slate-400">{role.text}</span>
              </span>
              <Tag className="max-[360px]:hidden">{role.model}</Tag>
            </div>
          </div>
        ))}
      </AppCard>
    </div>
  );
}
