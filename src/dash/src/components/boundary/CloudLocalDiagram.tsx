import { ArrowDownUp, Cloud, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

const CLOUD_ITEMS = ["Account and sign-in", "Projects and targets", "Campaign metadata", "Finding metadata", "Analytics", "Device status", "Subscription"];
const LOCAL_ITEMS = ["Attack engine", "LLM calls", "Payload generation", "Judging", "Sensitive transcripts", "Detailed evidence"];

export interface CloudLocalDiagramProps {
  evidenceSynced?: boolean;
  className?: string;
}

// follows the sync setting, so the picture never claims evidence is local when it is not
export function CloudLocalDiagram({ evidenceSynced = false, className }: CloudLocalDiagramProps) {
  return (
    <div className={cn("grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]", className)}>
      <div className="rounded-md border p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md border bg-background">
            <Cloud className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Aevrin Cloud</p>
            <p className="text-xs text-muted-foreground">Control plane - manage and view</p>
          </div>
        </div>
        <ul className="space-y-1.5">
          {CLOUD_ITEMS.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm">
              <span className="size-1.5 rounded-full bg-muted-foreground" />
              {item}
            </li>
          ))}
          {evidenceSynced && (
            <li className="flex items-center gap-2 text-sm">
              <span className="size-1.5 rounded-full bg-warning" />
              Detailed evidence (you opted in)
            </li>
          )}
        </ul>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground md:flex-col">
        <ArrowDownUp className="size-4" />
        <span className="text-center">{evidenceSynced ? "Metadata and evidence" : "Metadata only"}</span>
      </div>

      <div className="rounded-md border bg-zinc-900 p-4 text-zinc-50 dark:bg-zinc-900">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-zinc-800">
            <HardDrive className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Your machine</p>
            <p className="text-xs text-zinc-400">ModelWrecker engine in Docker - compute</p>
          </div>
        </div>
        <ul className="space-y-1.5">
          {LOCAL_ITEMS.filter((item) => !(evidenceSynced && item === "Detailed evidence")).map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm">
              <span className="size-1.5 rounded-full bg-zinc-400" />
              {item}
            </li>
          ))}
          {evidenceSynced && (
            <li className="flex items-center gap-2 text-sm">
              <span className="size-1.5 rounded-full bg-zinc-400" />
              Detailed evidence (a copy is also synced)
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
