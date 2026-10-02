import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { apiClient } from "@/api";
import type { Project } from "@/types";

interface ActiveProjectContextValue {
  projects: Project[];
  activeProjectId: string | null; // null = "All projects"
  activeProject: Project | null;
  setActiveProjectId: (id: string | null) => void;
  /** Re-read the project list after a create/rename/archive/delete. */
  refreshProjects: () => void;
  loading: boolean;
}

const Ctx = createContext<ActiveProjectContextValue | null>(null);
const STORAGE_KEY = "aevrin-active-project";

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProjectId, setActiveId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  const [nonce, setNonce] = useState(0);
  const refreshProjects = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    apiClient
      .listProjects()
      .then((p) => {
        if (active) setProjects(p);
      })
      .catch(() => {
        // The switcher falls back to "All projects"; pages show their own error states.
        if (active) setProjects([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [nonce]);

  const setActiveProjectId = useCallback((id: string | null) => {
    setActiveId(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  const value = useMemo(
    () => ({ projects, activeProjectId, activeProject, setActiveProjectId, refreshProjects, loading }),
    [projects, activeProjectId, activeProject, setActiveProjectId, refreshProjects, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveProject(): ActiveProjectContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActiveProject must be used within ActiveProjectProvider");
  return ctx;
}
