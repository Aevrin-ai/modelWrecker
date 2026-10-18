import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, SkeletonCards } from "@/components/States";
import { ConfirmDialog, RenameDialog } from "@/components/dialogs";
import { ControlPlaneCallout } from "@/components/LocalBoundary";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import type { Campaign } from "@/types";
import { AttackStatsCard } from "./campaignDetail/AttackStatsCard";
import { CampaignActions } from "./campaignDetail/CampaignActions";
import { CampaignConfigCard } from "./campaignDetail/CampaignConfigCard";
import { CampaignFindingsCard } from "./campaignDetail/CampaignFindingsCard";
import { CampaignMetrics } from "./campaignDetail/CampaignMetrics";
import { CampaignTimelineCard } from "./campaignDetail/CampaignTimelineCard";
import { TranscriptCard } from "./campaignDetail/TranscriptCard";

export function CampaignDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const campaign = useAsync(() => apiClient.getCampaign(id), [id]);
  const timeline = useAsync(() => apiClient.getCampaignTimeline(id), [id]);
  const stats = useAsync(() => apiClient.getCampaignStats(id), [id]);
  const findings = useAsync(() => apiClient.listFindings({ campaignId: id }), [id]);
  const transcript = useAsync(() => apiClient.getCampaignTranscript(id), [id]);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const back = (
    <Link to="/campaigns" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Campaigns
    </Link>
  );

  if (campaign.loading && !campaign.data) return <SkeletonCards count={4} className="sm:grid-cols-2" />;
  if (campaign.error) return <ErrorState title="Unable to load this campaign." onRetry={campaign.refetch} />;
  if (!campaign.data)
    return (
      <div className="space-y-6">
        {back}
        <EmptyState title="Campaign not found" description="It may have been deleted, or it belongs to another project." />
      </div>
    );

  const campaignData = campaign.data;
  const canMarkReady = campaignData.status === "draft";
  const canUnmark = campaignData.status === "ready";

  async function toggleReady(selected: Campaign) {
    setBusy(true);
    try {
      if (selected.status === "draft") {
        await apiClient.markCampaignReady(selected.id);
        toast({ title: "Marked ready", description: "Your local engine will pick it up on its next sync." });
      } else {
        await apiClient.unmarkCampaignReady(selected.id);
        toast({ title: "Moved back to draft" });
      }
      campaign.refetch();
      timeline.refetch();
    } catch {
      toast({ title: "Could not update the campaign", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={back}
        title={campaignData.name}
        description={`${campaignData.strategies.length} strategies against ${campaignData.targetName}`}
        actions={
          <CampaignActions
            status={campaignData.status}
            canMarkReady={canMarkReady}
            canUnmark={canUnmark}
            busy={busy}
            onToggleReady={() => toggleReady(campaignData)}
            onRename={() => setRenaming(true)}
            onDelete={() => setDeleting(true)}
          />
        }
      />

      {(canMarkReady || canUnmark) && (
        <ControlPlaneCallout title="The cloud does not run this campaign">
          Marking a campaign ready only flags it. Your local ModelWrecker engine picks it up, runs every attack on your
          machine, and syncs summarized results back here.
        </ControlPlaneCallout>
      )}

      <CampaignMetrics campaign={campaignData} />

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <AttackStatsCard stats={stats} />
        <CampaignConfigCard campaign={campaignData} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <CampaignTimelineCard timeline={timeline} />
        <CampaignFindingsCard findings={findings} />
      </div>

      <TranscriptCard transcript={transcript} />

      <RenameDialog
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Rename campaign"
        initial={campaignData.name}
        onSave={async (name) => {
          await apiClient.renameCampaign(campaignData.id, name);
          campaign.refetch();
        }}
      />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete this campaign?"
        description="This removes the campaign and its synced metadata from the dashboard. Local results on your device are not touched."
        confirmLabel="Delete campaign"
        destructive
        onConfirm={async () => {
          await apiClient.deleteCampaign(campaignData.id);
          navigate("/campaigns");
        }}
      />
    </div>
  );
}
