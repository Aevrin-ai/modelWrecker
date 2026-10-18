import { Link } from "react-router-dom";
import { RefreshCw, Swords } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button, buttonClasses } from "@/components/ui/button";
import { EngineStatusCard } from "@/components/EngineStatus";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useActiveProject } from "@/hooks/useActiveProject";
import { DataLocationCard } from "./overview/DataLocationCard";
import { HeadlineStats } from "./overview/HeadlineStats";
import { RecentCampaignsCard } from "./overview/RecentCampaignsCard";
import { RecentFindingsCard } from "./overview/RecentFindingsCard";
import { SecondaryStats } from "./overview/SecondaryStats";
import { SeverityCard } from "./overview/SeverityCard";
import { SuccessfulAttacksCard } from "./overview/SuccessfulAttacksCard";
import { SuccessRateCard } from "./overview/SuccessRateCard";

export function Overview() {
  const { activeProjectId, activeProject } = useActiveProject();
  const projectId = activeProjectId ?? undefined;
  const overview = useAsync(() => apiClient.getOverview(projectId), [projectId]);
  const analytics = useAsync(() => apiClient.getAnalytics(projectId), [projectId]);
  const findings = useAsync(() => apiClient.listFindings({ projectId }), [projectId]);
  const campaigns = useAsync(() => apiClient.listCampaigns({ projectId }), [projectId]);
  const settings = useAsync(() => apiClient.getSettings(), []);

  function refreshAll() {
    overview.refetch();
    analytics.refetch();
    findings.refetch();
    campaigns.refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={
          activeProject
            ? `What is happening with ModelWrecker in ${activeProject.name}.`
            : "What is happening with ModelWrecker across all your projects."
        }
        actions={
          <>
            <Button variant="outline" size="icon" onClick={refreshAll} aria-label="Refresh">
              <RefreshCw />
            </Button>
            <Link to="/campaigns?new=1" className={buttonClasses("default", "default")}>
              <Swords />
              New campaign
            </Link>
          </>
        }
      />

      <HeadlineStats overview={overview} />

      <div className="grid gap-4 lg:grid-cols-3">
        <SuccessfulAttacksCard analytics={analytics} />
        <SuccessRateCard analytics={analytics} />
        <EngineStatusCard projectId={projectId} />
      </div>

      <SecondaryStats overview={overview} />

      <div className="grid gap-4 xl:grid-cols-3">
        <RecentFindingsCard findings={findings} />
        <SeverityCard analytics={analytics} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <RecentCampaignsCard campaigns={campaigns} />
        <DataLocationCard settings={settings} />
      </div>
    </div>
  );
}
