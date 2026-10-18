import type { SearchResult } from "@/types";
import * as mock from "@/data/mock";
import { mockState } from "./mockState";

export function searchMockRecords(lowerQuery: string): SearchResult[] {
  const results: SearchResult[] = [];
  const matches = (text: string) => text.toLowerCase().includes(lowerQuery);

  for (const project of mockState.projects) {
    if (matches(project.name)) {
      results.push({ id: project.id, kind: "project", title: project.name, subtitle: "Project", href: `/projects/${project.id}` });
    }
  }
  for (const target of mockState.targets) {
    if (matches(target.name)) {
      results.push({ id: target.id, kind: "target", title: target.name, subtitle: `${target.type} - ${target.provider}`, href: `/targets` });
    }
  }
  for (const campaign of mockState.campaigns) {
    if (matches(campaign.name)) {
      const subtitle = `Campaign - ${campaign.status}`;
      results.push({ id: campaign.id, kind: "campaign", title: campaign.name, subtitle, href: `/campaigns/${campaign.id}` });
    }
  }
  for (const finding of mockState.findings) {
    if (matches(finding.title)) {
      const subtitle = `${finding.severity} finding`;
      results.push({ id: finding.id, kind: "finding", title: finding.title, subtitle, href: `/findings/${finding.id}` });
    }
  }
  for (const device of mockState.devices) {
    if (matches(device.name)) {
      results.push({ id: device.id, kind: "device", title: device.name, subtitle: `Device - ${device.status}`, href: `/devices` });
    }
  }
  for (const report of mock.reports) {
    if (matches(report.name)) {
      results.push({ id: report.id, kind: "report", title: report.name, subtitle: `Report - ${report.kind}`, href: `/reports` });
    }
  }
  return results.slice(0, 8);
}
