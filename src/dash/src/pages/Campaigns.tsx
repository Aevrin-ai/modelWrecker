import { useMemo, useState } from "react";
import { Plus, Search, Swords } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { CampaignDialog } from "@/components/dialogs";
import { RunsLocallyChip } from "@/components/LocalBoundary";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useActiveProject } from "@/hooks/useActiveProject";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/constants";
import type { CampaignStatus } from "@/types";
import { CampaignCardList } from "./campaigns/CampaignCardList";
import { CampaignsTable } from "./campaigns/CampaignsTable";

const STATUSES = Object.keys(CAMPAIGN_STATUS_LABEL) as CampaignStatus[];

export function Campaigns() {
  const { activeProjectId } = useActiveProject();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CampaignStatus | "all">("all");
  const [creating, setCreating] = useState(false);

  const campaigns = useAsync(() => apiClient.listCampaigns({ projectId: activeProjectId ?? undefined }), [activeProjectId]);
  const targets = useAsync(() => apiClient.listTargets({ projectId: activeProjectId ?? undefined }), [activeProjectId]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (campaigns.data ?? []).filter(
      (campaign) =>
        (status === "all" || campaign.status === status) &&
        (!search || campaign.name.toLowerCase().includes(search) || campaign.targetName.toLowerCase().includes(search)),
    );
  }, [campaigns.data, query, status]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Configure campaigns here. Your local ModelWrecker engine runs them and syncs the results back."
        actions={
          <>
            <RunsLocallyChip />
            <Button onClick={() => setCreating(true)}>
              <Plus /> New campaign
            </Button>
          </>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search campaigns or targets" className="pl-9" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value as CampaignStatus | "all")}>
            <option value="all">All statuses</option>
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {CAMPAIGN_STATUS_LABEL[option]}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <DataState
        loading={campaigns.loading}
        error={campaigns.error}
        data={campaigns.data}
        onRetry={campaigns.refetch}
        errorTitle="Unable to load campaigns."
        skeleton={<SkeletonRows rows={6} cols={6} />}
        empty={
          <EmptyState
            icon={Swords}
            title="No campaigns yet"
            description="Create a campaign, mark it ready, and your connected local engine will pick it up."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus /> New campaign
              </Button>
            }
          />
        }
      >
        {() =>
          filtered.length === 0 ? (
            <EmptyState icon={Search} title="No campaigns match your filters" description="Clear the search or pick another status." />
          ) : (
            <>              <CampaignsTable campaigns={filtered} />
              <CampaignCardList campaigns={filtered} />
            </>
          )
        }
      </DataState>

      <CampaignDialog
        open={creating}
        onClose={() => setCreating(false)}
        targets={targets.data ?? []}
        onSaved={() => campaigns.refetch()}
      />
    </div>
  );
}
