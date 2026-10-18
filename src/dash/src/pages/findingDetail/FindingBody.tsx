import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ConfidenceBadge, FindingStatusBadge, OutcomeBadge, SeverityBadge } from "@/components/StatusBadges";
import { apiClient } from "@/api";
import { FINDING_STATUS_LABEL } from "@/lib/constants";
import type { Finding, FindingStatus } from "@/types";
import { ContextCard } from "./ContextCard";
import { EvidenceCard } from "./EvidenceCard";
import { RelatedFindingsCard } from "./RelatedFindingsCard";
import { ReliabilityCard } from "./ReliabilityCard";
import { SignalsCard } from "./SignalsCard";
import { TaxonomyCard } from "./TaxonomyCard";

const STATUSES: FindingStatus[] = ["open", "triaged", "fixed", "accepted-risk"];

export interface FindingBodyProps {
  finding: Finding;
}

export function FindingBody({ finding }: FindingBodyProps) {
  const [status, setStatus] = useState<FindingStatus>(finding.status);
  const [saving, setSaving] = useState(false);

  async function changeStatus(next: FindingStatus) {
    setStatus(next);
    setSaving(true);
    try {
      await apiClient.updateFindingStatus(finding.id, next);
    } finally {
      setSaving(false);
    }
  }

  const reliability = finding.reliability;

  return (
    <div className="space-y-6">
      <PageHeader
        title={finding.title}
        description={finding.summary}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={status}
              onChange={(e) => changeStatus(e.target.value as FindingStatus)}
              disabled={saving}
              aria-label="Finding status"
            >
              {STATUSES.map((option) => (
                <option key={option} value={option}>
                  {FINDING_STATUS_LABEL[option]}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={finding.severity} />
        <FindingStatusBadge status={status} />
        <OutcomeBadge outcome={finding.outcome} />
        <ConfidenceBadge level={reliability.confidence} />
        <Badge tone="bg-secondary text-secondary-foreground">Score {finding.score}/10</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ReliabilityCard reliability={reliability} />
          <SignalsCard signals={finding.signals} />
          <EvidenceCard finding={finding} />
        </div>

        <div className="space-y-4">
          <ContextCard finding={finding} />
          <TaxonomyCard taxonomy={finding.taxonomy} />
          {finding.relatedFindingIds.length > 0 && <RelatedFindingsCard findingIds={finding.relatedFindingIds} />}
        </div>
      </div>
    </div>
  );
}
