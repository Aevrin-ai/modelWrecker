import { type ApiApp, type AppMiddleware } from "../../types/appEnv";
import type { Deps } from "../../types/deps";
import { listProjects, createProject, readProject, updateProject, deleteProject } from "../../controllers/dashboard/projects";

export function registerProjectRoutes(app: ApiApp, deps: Deps, requireUser: AppMiddleware): void {
  app.get("/projects", requireUser, (c) => listProjects(c, deps));
  app.post("/projects", requireUser, (c) => createProject(c, deps));
  app.get("/projects/:id", requireUser, (c) => readProject(c, deps));
  app.patch("/projects/:id", requireUser, (c) => updateProject(c, deps));
  app.delete("/projects/:id", requireUser, (c) => deleteProject(c, deps));
}
