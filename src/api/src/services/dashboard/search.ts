import type { Row } from "../../types/deps";
import { str } from "../../lib/strings";

export const RESULTS_PER_KIND = 5;

export function searchResults(projects: Row[], targets: Row[], campaigns: Row[], findings: Row[], devices: Row[]) {
  return [
    ...projects.map((row) => ({ id: str(row.id), kind: "project", title: str(row.name), subtitle: "Project", href: `/projects/${row.id}` })),
    ...targets.map((row) => ({ id: str(row.id), kind: "target", title: str(row.name), subtitle: `Target - ${str(row.type)}`, href: "/targets" })),
    ...campaigns.map((row) => ({ id: str(row.id), kind: "campaign", title: str(row.name), subtitle: "Campaign", href: `/campaigns/${row.id}` })),
    ...findings.map((row) => ({
      id: str(row.id),
      kind: "finding",
      title: str(row.title),
      subtitle: `Finding - ${str(row.severity)}`,
      href: `/findings/${row.id}`,
    })),
    ...devices
      .filter((row) => !row.revoked)
      .map((row) => ({ id: str(row.id), kind: "device", title: str(row.name), subtitle: "Device", href: "/devices" })),
  ];
}
