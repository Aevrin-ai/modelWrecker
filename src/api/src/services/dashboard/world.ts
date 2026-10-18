import type { Database, Row } from "../../types/deps";
import { str } from "../../lib/strings";
import { ownedRowsRepository, type OwnedTable } from "../../repositories/ownedRows";

/** Every row one account owns that the dashboard views are built from. */
export interface World {
  projects: Row[];
  targets: Row[];
  campaigns: Row[];
  runs: Row[];
  findings: Row[];
  devices: Row[];
}

export async function loadWorld(db: Database, owner: string): Promise<World> {
  const ownedRows = (table: OwnedTable) => ownedRowsRepository(db, table).listForOwner(owner);
  const [projects, targets, campaigns, runs, findings, devices] = await Promise.all([
    ownedRows("projects"),
    ownedRows("targets"),
    ownedRows("campaigns"),
    ownedRows("runs"),
    ownedRows("findings"),
    ownedRows("devices"),
  ]);
  return { projects, targets, campaigns, runs, findings, devices: devices.filter((device) => !device.revoked) };
}

/** The part of a world that belongs to one project, or the whole world when no project is given. */
export function scope(world: World, projectId?: string): World {
  if (!projectId) return world;
  const campaigns = world.campaigns.filter((campaign) => str(campaign.project_id) === projectId);
  const campaignIds = new Set(campaigns.map((campaign) => str(campaign.id)));
  return {
    projects: world.projects.filter((project) => str(project.id) === projectId),
    targets: world.targets.filter((target) => str(target.project_id) === projectId),
    campaigns,
    runs: world.runs.filter((run) => campaignIds.has(str(run.campaign_id))),
    findings: world.findings.filter((finding) => str(finding.project_id) === projectId),
    devices: world.devices.filter((device) => str(device.project_id) === projectId),
  };
}
