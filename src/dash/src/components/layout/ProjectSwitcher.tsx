import { Check, ChevronsUpDown, FolderKanban, Layers } from "lucide-react";
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown";
import { useActiveProject } from "@/hooks/useActiveProject";
import { cn } from "@/lib/utils";

/** The active-project selector in the header. "All projects" = null. */
export function ProjectSwitcher({ fullWidth }: { fullWidth?: boolean }) {
  const { projects, activeProjectId, activeProject, setActiveProjectId } = useActiveProject();
  const label = activeProject ? activeProject.name : "All projects";

  return (
    <Dropdown
      align="start"
      className={fullWidth ? "w-full" : undefined}
      triggerClassName={fullWidth ? "w-full" : undefined}
      panelClassName="w-64"
      trigger={
        <span
          className={cn(
            "flex h-8 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent",
            fullWidth ? "w-full" : "max-w-[12rem]",
          )}
        >
          <Layers className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-left">{label}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </span>
      }
    >
      {(close) => (
        <>
          <DropdownLabel>Switch project</DropdownLabel>
          <DropdownItem
            onClick={() => {
              setActiveProjectId(null);
              close();
            }}
          >
            <Layers className="size-4 text-muted-foreground" />
            <span className="flex-1">All projects</span>
            {activeProjectId === null && <Check className="size-4" />}
          </DropdownItem>
          <DropdownSeparator />
          {projects
            .filter((p) => !p.archived)
            .map((p) => (
              <DropdownItem
                key={p.id}
                onClick={() => {
                  setActiveProjectId(p.id);
                  close();
                }}
              >
                <FolderKanban className="size-4 text-muted-foreground" />
                <span className={cn("flex-1 truncate", activeProjectId === p.id && "font-medium")}>
                  {p.name}
                </span>
                {activeProjectId === p.id && <Check className="size-4" />}
              </DropdownItem>
            ))}
        </>
      )}
    </Dropdown>
  );
}
