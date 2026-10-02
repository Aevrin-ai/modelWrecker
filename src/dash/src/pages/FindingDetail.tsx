import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Crosshair,
  Swords,
  FlaskConical,
  CheckCircle2,
  Terminal,
  GitBranch,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  ConfidenceBadge,
  FindingStatusBadge,
  OutcomeBadge,
  SeverityBadge,
  TargetTypeBadge,
} from "@/components/StatusBadges";
import { EvidenceLocalNotice } from "@/components/LocalBoundary";
import { DataState } from "@/components/States";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime, formatPercent, humanize } from "@/lib/format";
import { FINDING_STATUS_LABEL } from "@/lib/constants";
import type { Finding, FindingStatus } from "@/types";

const STATUSES: FindingStatus[] = ["open", "triaged", "fixed", "accepted-risk"];

export function FindingDetail() {
  const { id = "" } = useParams();
  const { data, loading, error, refetch } = useAsync(() => apiClient.getFinding(id), [id]);

  return (
    <div className="space-y-6">
      <Link
        to="/findings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to findings
      </Link>

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={refetch}
        skeleton={<Skeleton className="h-96 w-full" />}
        isEmpty={(f) => f === null}
        empty={<p className="text-sm text-muted-foreground">Finding not found.</p>}
      >
        {(finding) => <FindingBody finding={finding!} />}
      </DataState>
    </div>
  );
}

function FindingBody({ finding }: { finding: Finding }) {
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

  const r = finding.reliability;

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
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {FINDING_STATUS_LABEL[s]}
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
        <ConfidenceBadge level={r.confidence} />
        <Badge tone="bg-secondary text-secondary-foreground">Score {finding.score}/10</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: context + reliability + signals */}
        <div className="space-y-4 lg:col-span-2">
          {/* Reliability */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="size-4 text-brand" />
                Reliability
              </CardTitle>
              <CardDescription>
                Verified by replaying the attack {r.attemptsRun} times. A one-shot success is luck - this is
                the measured success rate with a Wilson 95% confidence interval.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Metric label="Success rate" value={formatPercent(r.successRate, 0)} />
                <Metric label="Successes" value={`${r.successes}/${r.attemptsRun}`} />
                <Metric label="Partials" value={String(r.partials)} />
                <Metric
                  label="95% CI"
                  value={`${formatPercent(r.ciLow, 0)} - ${formatPercent(r.ciHigh, 0)}`}
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Confidence interval</span>
                  <span className="tabular-nums">
                    {formatPercent(r.ciLow, 0)} - {formatPercent(r.ciHigh, 0)}
                  </span>
                </div>
                <Progress value={r.successRate} indicatorClassName="bg-brand" />
              </div>
              <div className="flex flex-wrap gap-2">
                <ConfidenceBadge level={r.confidence} />
                {r.highVariance && (
                  <Badge tone="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    High variance
                  </Badge>
                )}
                {r.backendPinned && (
                  <Badge tone="bg-secondary text-secondary-foreground">Backend pinned</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Signals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-brand" />
                Judge signals
              </CardTitle>
              <CardDescription>
                The multi-signal judge combines detectors; no single signal invents a finding.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {finding.signals.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span
                    className={`size-2 shrink-0 rounded-full ${s.hit ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{humanize(s.signal)}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.detail}</p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{formatPercent(s.score, 0)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Evidence */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="size-4 text-brand" />
                Evidence
              </CardTitle>
              <CardDescription>The exact prompt sent and the model reply, when synced.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {finding.evidence.synced ? (
                <EvidenceView finding={finding} />
              ) : (
                <EvidenceLocalNotice />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: meta */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <MetaLink icon={Crosshair} label="Target" to="/targets">
                <span className="flex items-center gap-2">
                  <TargetTypeBadge type={finding.targetType} />
                  {finding.targetName}
                </span>
              </MetaLink>
              <MetaLink icon={Swords} label="Campaign" to={`/campaigns/${finding.campaignId}`}>
                {finding.campaignName}
              </MetaLink>
              <MetaRow label="Strategy">
                <span className="font-mono text-xs">{finding.strategy}</span>
              </MetaRow>
              <MetaRow label="Model">{finding.model}</MetaRow>
              <MetaRow label="Provider">{finding.provider}</MetaRow>
              <MetaRow label="Discovered">{formatDateTime(finding.discoveredAt)}</MetaRow>
              <MetaRow label="Last seen">{formatDateTime(finding.lastSeenAt)}</MetaRow>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Taxonomy</CardTitle>
              <CardDescription>Mapped security frameworks.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {finding.taxonomy.map((t, i) => (
                <Badge key={i} tone="bg-brand/10 text-brand" className="font-mono">
                  {t.id}
                  {t.title ? ` ${t.title}` : ""}
                </Badge>
              ))}
            </CardContent>
          </Card>

          {finding.relatedFindingIds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="size-4" />
                  Related findings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {finding.relatedFindingIds.map((rid) => (
                  <Link
                    key={rid}
                    to={`/findings/${rid}`}
                    className="block rounded-md px-2 py-1.5 font-mono text-xs text-brand hover:bg-muted"
                  >
                    {rid}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function EvidenceView({ finding }: { finding: Finding }) {
  const e = finding.evidence;
  return (
    <div className="space-y-4">
      {e.transformChain && e.transformChain.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Transforms:</span>
          {e.transformChain.map((t) => (
            <Badge key={t} tone="bg-secondary text-secondary-foreground" className="font-mono">
              {t}
            </Badge>
          ))}
        </div>
      )}
      {e.payload && (
        <CodeBlock label="Prompt sent" text={e.payload} />
      )}
      {e.targetResponse && (
        <CodeBlock label="Model reply" text={e.targetResponse} tone="reply" />
      )}
      {e.attackSequence && e.attackSequence.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Attack sequence</p>
          <div className="space-y-2">
            {e.attackSequence.map((step) => (
              <div key={step.step} className="rounded-lg border p-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {step.role}
                </p>
                <p className="text-sm">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {e.toolCalls && e.toolCalls.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Observed tool calls</p>
          {e.toolCalls.map((tc, i) => (
            <pre key={i} className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
              {tc.name}({JSON.stringify(tc.args)})
            </pre>
          ))}
        </div>
      )}
      {e.reproductionSteps && <CodeBlock label="Reproduce" text={e.reproductionSteps} tone="cmd" />}
    </div>
  );
}

function CodeBlock({ label, text, tone }: { label: string; text: string; tone?: "reply" | "cmd" }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <pre
        className={`overflow-x-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-xs ${
          tone === "reply"
            ? "bg-brand-muted/40"
            : tone === "cmd"
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
        }`}
      >
        {text}
      </pre>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{children}</span>
    </div>
  );
}

function MetaLink({
  icon: Icon,
  label,
  to,
  children,
}: {
  icon: typeof Crosshair;
  label: string;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <Link to={to} className="truncate text-right font-medium text-brand hover:underline">
        {children}
      </Link>
    </div>
  );
}
