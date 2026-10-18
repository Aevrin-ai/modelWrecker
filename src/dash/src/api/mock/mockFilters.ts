import type { ListFilter } from "../client";
import type { Campaign, Finding, Report, Target } from "@/types";
import { matchesQuery } from "./mockState";

export function filterTargets(targets: Target[], filter?: ListFilter): Target[] {
  return targets.filter(
    (target) =>
      (!filter?.projectId || target.projectId === filter.projectId) &&
      matchesQuery([target.name, target.provider, target.model, target.type], filter?.query),
  );
}

export function filterCampaigns(campaigns: Campaign[], filter?: ListFilter): Campaign[] {
  return campaigns.filter(
    (campaign) =>
      (!filter?.projectId || campaign.projectId === filter.projectId) &&
      (!filter?.targetId || campaign.targetId === filter.targetId) &&
      matchesQuery([campaign.name, campaign.targetName, campaign.status, ...campaign.strategies], filter?.query),
  );
}

export function filterFindings(findings: Finding[], filter?: ListFilter): Finding[] {
  return findings.filter(
    (finding) =>
      (!filter?.projectId || finding.projectId === filter.projectId) &&
      (!filter?.campaignId || finding.campaignId === filter.campaignId) &&
      (!filter?.targetId || finding.targetId === filter.targetId) &&
      matchesQuery([finding.title, finding.targetName, finding.strategy, finding.severity, finding.status], filter?.query),
  );
}

export function filterReports(reports: Report[], filter?: ListFilter): Report[] {
  return reports.filter(
    (report) =>
      (!filter?.projectId || report.projectId === filter.projectId) &&
      matchesQuery([report.name, report.kind], filter?.query),
  );
}
