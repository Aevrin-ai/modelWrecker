import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, Gift, KeyRound, Pencil, RotateCcw, ShieldOff, Trash2, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox, Field } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataState, SkeletonCards } from "@/components/States";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import { formatCurrency, formatDate, formatDateTime, formatNumber, humanize, relativeTime } from "@/lib/format";
import { METER_LABEL, METER_ORDER, formatPaise } from "@/lib/plans";
import type { MeterKey, Plan } from "@/types";
import { ActionDialog } from "../ActionDialog";
import { adminClient } from "../client";
import type { UserDetail as Detail } from "../client";
import { PlanBadge, actionLabel, detailSummary } from "./shared";

type Action =
  | { kind: "plan" }
  | { kind: "bonus" }
  | { kind: "credit" }
  | { kind: "sync" }
  | { kind: "rename" }
  | { kind: "suspend" }
  | { kind: "reset-mfa" }
  | { kind: "delete" }
  | { kind: "refund"; paymentId: string; number: string; amount: number }
  | { kind: "revoke"; deviceId: string; name: string }
  | null;

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
/** End of the chosen day in UTC, so "paid until 31 Dec" includes all of 31 Dec. */
const endOfDay = (d: string) => (d ? new Date(`${d}T23:59:59Z`).toISOString() : null);

export function UserDetail() {
  const { id = "" } = useParams();
  const user = useAsync(() => adminClient.user(id), [id]);
  const [action, setAction] = useState<Action>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const after = (title: string) => {
    toast({ title });
    user.refetch();
  };

  return (
    <div className="space-y-6">
      <Link to="/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Users
      </Link>
      <DataState loading={user.loading} error={user.error} data={user.data} onRetry={user.refetch} skeleton={<SkeletonCards count={4} className="lg:grid-cols-2" />}>
        {(u) => (
          <>
            <Header u={u} onRename={() => setAction({ kind: "rename" })} />
            <div className="grid gap-4 lg:grid-cols-3">
              <SubscriptionCard u={u} onChange={() => setAction({ kind: "plan" })} />
              <CreditCard u={u} onAdjust={() => setAction({ kind: "credit" })} />
              <BonusCard u={u} onSet={() => setAction({ kind: "bonus" })} />
            </div>
            <UsageCard u={u} />
            <PaymentsCard u={u} onRefund={(p) => setAction({ kind: "refund", paymentId: p.id, number: p.number, amount: p.amount })} />
            <div className="grid gap-4 lg:grid-cols-2">
              <DevicesCard u={u} onRevoke={(d) => setAction({ kind: "revoke", deviceId: d.id, name: d.name })} />
              <SettingsCard u={u} onEdit={() => setAction({ kind: "sync" })} />
            </div>
            <DangerZone u={u} onAction={(kind) => setAction({ kind } as Action)} />
            <AuditCard u={u} />
            <Dialogs
              u={u}
              action={action}
              close={() => setAction(null)}
              done={after}
              deleted={() => {
                toast({ title: "User deleted" });
                navigate("/users", { replace: true });
              }}
            />
          </>
        )}
      </DataState>
    </div>
  );
}

function Header({ u, onRename }: { u: Detail; onRename: () => void }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
          {u.email}
          <PlanBadge plan={u.subscription.effectivePlan} />
          {u.suspendedAt && <Badge tone="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200">Suspended</Badge>}
          {u.isStaff && <Badge tone="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">Staff</Badge>}
        </h1>
        <p className="text-sm text-muted-foreground">
          {u.name || "No name"} . Joined {formatDate(u.createdAt)} . Last sign-in {u.account?.lastSignInAt ? relativeTime(u.account.lastSignInAt) : "unknown"}
          {u.account?.providers.length ? ` . ${u.account.providers.map(humanize).join(", ")}` : ""}
        </p>
        <p className="font-mono text-xs text-muted-foreground">{u.id}</p>
        {u.suspendedAt && (
          <p className="text-sm text-destructive">
            Suspended {formatDateTime(u.suspendedAt)}
            {u.suspendedReason ? `: ${u.suspendedReason}` : ""}
          </p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onRename}>
        <Pencil /> Rename
      </Button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function SubscriptionCard({ u, onChange }: { u: Detail; onChange: () => void }) {
  const s = u.subscription;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan</CardTitle>
        <CardDescription>What this account can use right now.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <Row label="In effect">
          <PlanBadge plan={s.effectivePlan} />
        </Row>
        {s.lapsed && <Row label="Lapsed from">{humanize(s.storedPlan)}</Row>}
        <Row label="Paid until">{s.effectivePlan === "free" ? "-" : s.paidUntil ? formatDate(s.paidUntil) : "No end date"}</Row>
        <Row label="Source">{humanize(s.source)}</Row>
        {s.interval && <Row label="Billing">{humanize(s.interval)}ly, prepaid</Row>}
        <Button className="mt-2 w-full" variant="outline" onClick={onChange}>
          Change plan
        </Button>
      </CardContent>
    </Card>
  );
}

function CreditCard({ u, onAdjust }: { u: Detail; onAdjust: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4" /> Account credit
        </CardTitle>
        <CardDescription>Applied automatically at the next checkout.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-semibold tabular-nums">{formatPaise(u.subscription.creditPaise)}</p>
        <ul className="max-h-32 space-y-1.5 overflow-y-auto text-xs">
          {u.creditLedger.length === 0 && <li className="text-muted-foreground">No credit changes yet.</li>}
          {u.creditLedger.map((l) => (
            <li key={l.id} className="flex justify-between gap-2">
              <span className="truncate text-muted-foreground" title={`${l.reason} (${l.actor})`}>
                {formatDate(l.createdAt)} . {l.reason}
              </span>
              <span className={l.deltaPaise < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}>
                {l.deltaPaise > 0 ? "+" : "-"}
                {formatPaise(Math.abs(l.deltaPaise))}
              </span>
            </li>
          ))}
        </ul>
        <Button className="w-full" variant="outline" onClick={onAdjust}>
          Add or remove credit
        </Button>
      </CardContent>
    </Card>
  );
}

function BonusCard({ u, onSet }: { u: Detail; onSet: () => void }) {
  const b = u.subscription.bonus;
  const any = METER_ORDER.some((m) => b[m] > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="size-4" /> Bonus
        </CardTitle>
        <CardDescription>Extra allowance on top of the plan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {!any && <p className="text-sm text-muted-foreground">No bonus.</p>}
        {any &&
          METER_ORDER.filter((m) => b[m] > 0).map((m) => (
            <Row key={m} label={METER_LABEL[m].label}>
              +{formatNumber(b[m])}
            </Row>
          ))}
        {any && <Row label="Until">{b.expires_at ? formatDate(b.expires_at) : "No end date"}</Row>}
        <Button className="mt-2 w-full" variant="outline" onClick={onSet}>
          {any ? "Change bonus" : "Give a bonus"}
        </Button>
      </CardContent>
    </Card>
  );
}

function UsageCard({ u }: { u: Detail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage, {u.usagePeriod}</CardTitle>
        <CardDescription>
          {u.projects.active} active of {u.projects.total} projects. Limits include any bonus.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        {METER_ORDER.map((m) => {
          const limit = u.subscription.limits[m];
          return (
            <div key={m}>
              <div className="flex justify-between text-sm">
                <span className="font-medium">{METER_LABEL[m].label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(u.usage[m])} / {limit == null ? "Unlimited" : formatNumber(limit)}
                </span>
              </div>
              <Progress value={limit ? u.usage[m] / limit : 0} className="mt-2" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function PaymentsCard({ u, onRefund }: { u: Detail; onRefund: (p: Detail["payments"][number]) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments</CardTitle>
        <CardDescription>Orders and confirmed purchases. A full refund takes back the time it bought.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {u.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Credit used</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {u.payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.number || p.orderId}</TableCell>
                  <TableCell>{formatDate(p.issuedAt)}</TableCell>
                  <TableCell>
                    {humanize(p.plan)} ({p.interval})
                  </TableCell>
                  <TableCell>{humanize(p.status)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(p.amount, p.currency)}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.creditApplied ? formatCurrency(p.creditApplied, p.currency) : "-"}</TableCell>
                  <TableCell className="text-right">
                    {p.status === "paid" && p.razorpayPaymentId && (
                      <Button variant="ghost" size="sm" onClick={() => onRefund(p)}>
                        <RotateCcw /> Refund
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function DevicesCard({ u, onRevoke }: { u: Detail; onRevoke: (d: Detail["devices"][number]) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Devices</CardTitle>
        <CardDescription>Engines signed in to this account. Revoking stops sync at once.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {u.devices.length === 0 && <p className="text-sm text-muted-foreground">No devices.</p>}
        {u.devices.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">
                {d.name} {d.revoked && <Badge>Revoked</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">
                {d.os} . engine {d.engineVersion || "?"} . seen {d.lastSeenAt ? relativeTime(d.lastSeenAt) : "never"}
              </p>
            </div>
            {!d.revoked && (
              <Button variant="ghost" size="sm" onClick={() => onRevoke(d)}>
                <ShieldOff /> Revoke
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SettingsCard({ u, onEdit }: { u: Detail; onEdit: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync settings</CardTitle>
        <CardDescription>What this account sends beyond summary metadata. Turning one off deletes the cloud copies.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <Row label="Detailed evidence">{u.settings.sync.detailedEvidence ? "On" : "Off"}</Row>
        <Row label="Full attack transcripts">{u.settings.sync.transcripts ? "On" : "Off"}</Row>
        {!u.subscription.features.evidence_storage && <p className="text-xs text-muted-foreground">Not kept on this plan (Pro feature), whatever is set here.</p>}
        <Button className="mt-2 w-full" variant="outline" onClick={onEdit}>
          Change sync settings
        </Button>
      </CardContent>
    </Card>
  );
}

function DangerZone({ u, onAction }: { u: Detail; onAction: (kind: "suspend" | "reset-mfa" | "delete") => void }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Account access</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => onAction("suspend")}>
          <Ban /> {u.suspendedAt ? "Restore access" : "Suspend"}
        </Button>
        {u.isStaff && u.staffMfaEnrolled && (
          <Button variant="outline" onClick={() => onAction("reset-mfa")}>
            <KeyRound /> Reset authenticator
          </Button>
        )}
        {!u.isStaff && (
          <Button variant="destructive" onClick={() => onAction("delete")}>
            <Trash2 /> Delete user
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function AuditCard({ u }: { u: Detail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>Admin changes to this account.</CardDescription>
      </CardHeader>
      <CardContent>
        {u.audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">No admin changes yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {u.audit.map((a) => (
              <li key={a.id} className="border-l-2 pl-3">
                <p>
                  <span className="font-medium">{actionLabel(a.action)}</span> by {a.adminEmail} . {formatDateTime(a.createdAt)}
                </p>
                {a.reason && <p className="text-muted-foreground">"{a.reason}"</p>}
                {Object.keys(a.detail).length > 0 && <p className="font-mono text-xs text-muted-foreground">{detailSummary(a.detail)}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Dialogs({ u, action, close, done, deleted }: { u: Detail; action: Action; close: () => void; done: (title: string) => void; deleted: () => void }) {
  const s = u.subscription;
  const [plan, setPlan] = useState<Plan["id"]>(s.effectivePlan);
  const [until, setUntil] = useState(dateInput(s.paidUntil));
  const [bonus, setBonus] = useState<Record<MeterKey, number>>({ campaigns: s.bonus.campaigns, attacks: s.bonus.attacks, devices: s.bonus.devices, projects: s.bonus.projects });
  const [bonusUntil, setBonusUntil] = useState(dateInput(s.bonus.expires_at));
  const [rupees, setRupees] = useState("");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [sync, setSync] = useState(u.settings.sync);
  const [name, setName] = useState(u.name);
  const [confirm, setConfirm] = useState("");
  const kind = action?.kind;

  return (
    <>
      <ActionDialog
        open={kind === "plan"}
        onClose={close}
        title="Change plan"
        description="Takes effect at once and appears in the user's next entitlement. A paid plan with no end date stays until changed."
        confirmLabel="Save plan"
        canSubmit={plan === "free" || !until || new Date(`${until}T23:59:59Z`).getTime() > Date.now()}
        onSubmit={async (reason) => {
          await adminClient.setPlan(u.id, plan, plan === "free" ? null : endOfDay(until), reason);
          done("Plan updated");
        }}
      >
        <Field label="Plan" htmlFor="adm-plan">
<div className="flex [&>div]:w-full">
          <Select id="adm-plan" value={plan} onChange={(e) => setPlan(e.target.value as Plan["id"])} className="w-full">
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </Select>
          </div>
        </Field>
        {plan !== "free" && (
          <Field label="Paid until" htmlFor="adm-until" hint="Leave empty for no end date.">
            <Input id="adm-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </Field>
        )}
      </ActionDialog>

      <ActionDialog
        open={kind === "bonus"}
        onClose={close}
        title="Bonus allowance"
        description="Added to the plan's monthly limits. Set all to 0 to remove the bonus."
        confirmLabel="Save bonus"
        onSubmit={async (reason) => {
          await adminClient.setBonus(u.id, { ...bonus, expiresAt: bonusUntil ? endOfDay(bonusUntil) : null }, reason);
          done("Bonus saved");
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          {METER_ORDER.map((m) => (
            <Field key={m} label={`+ ${METER_LABEL[m].label}`} htmlFor={`adm-b-${m}`}>
              <Input id={`adm-b-${m}`} type="number" min={0} value={bonus[m]} onChange={(e) => setBonus({ ...bonus, [m]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
            </Field>
          ))}
        </div>
        <Field label="Until" htmlFor="adm-b-until" hint="Leave empty for no end date.">
          <Input id="adm-b-until" type="date" value={bonusUntil} onChange={(e) => setBonusUntil(e.target.value)} />
        </Field>
      </ActionDialog>

      <ActionDialog
        open={kind === "credit"}
        onClose={close}
        title="Account credit"
        description={`Balance now: ${formatPaise(s.creditPaise)}. Credit is taken off the user's next purchase. It is not cash and cannot go below zero.`}
        confirmLabel={direction === "add" ? "Add credit" : "Remove credit"}
        canSubmit={Number(rupees) > 0}
        onSubmit={async (reason) => {
          const paise = Math.round(Number(rupees) * 100);
          await adminClient.adjustCredit(u.id, direction === "add" ? paise : -paise, reason);
          setRupees("");
          done("Credit updated");
        }}
      >
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Field label="Change" htmlFor="adm-c-dir">
<div className="flex">
            <Select id="adm-c-dir" value={direction} onChange={(e) => setDirection(e.target.value as "add" | "remove")}>
              <option value="add">Add</option>
              <option value="remove">Remove</option>
            </Select>
            </div>
          </Field>
          <Field label="Amount (rupees)" htmlFor="adm-c-amt">
            <Input id="adm-c-amt" type="number" min={1} step="1" value={rupees} onChange={(e) => setRupees(e.target.value)} placeholder="500" />
          </Field>
        </div>
      </ActionDialog>

      <ActionDialog
        open={kind === "sync"}
        onClose={close}
        title="Sync settings"
        description="Turning a setting off deletes the copies already in the cloud. The user's local runs keep the originals."
        confirmLabel="Save settings"
        onSubmit={async (reason) => {
          await adminClient.setSync(u.id, sync, reason);
          done("Sync settings saved");
        }}
      >
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={sync.detailedEvidence} onChange={(v) => setSync({ ...sync, detailedEvidence: v })} /> Detailed evidence
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={sync.transcripts} onChange={(v) => setSync({ ...sync, transcripts: v })} /> Full attack transcripts
        </label>
      </ActionDialog>

      <ActionDialog
        open={kind === "rename"}
        onClose={close}
        title="Rename user"
        confirmLabel="Save name"
        canSubmit={name.trim().length > 0}
        onSubmit={async (reason) => {
          await adminClient.rename(u.id, name.trim(), reason);
          done("Name saved");
        }}
      >
        <Field label="Display name" htmlFor="adm-name">
          <Input id="adm-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
        </Field>
      </ActionDialog>

      <ActionDialog
        open={kind === "suspend"}
        onClose={close}
        title={u.suspendedAt ? "Restore access" : "Suspend account"}
        description={
          u.suspendedAt
            ? "The user can sign in, use the dashboard, and sync again."
            : "The user is signed out at their next token refresh, cannot use the dashboard or API, and their devices stop syncing. Nothing is deleted."
        }
        destructive={!u.suspendedAt}
        confirmLabel={u.suspendedAt ? "Restore access" : "Suspend"}
        onSubmit={async (reason) => {
          await adminClient.suspend(u.id, !u.suspendedAt, reason);
          done(u.suspendedAt ? "Access restored" : "Account suspended");
        }}
      />

      <ActionDialog
        open={kind === "reset-mfa"}
        onClose={close}
        title="Reset authenticator"
        description="Ends this admin's sessions and removes their authenticator. They set up a new one at their next admin sign-in."
        destructive
        confirmLabel="Reset authenticator"
        onSubmit={async (reason) => {
          await adminClient.resetMfa(u.id, reason);
          done("Authenticator reset");
        }}
      />

      <ActionDialog
        open={kind === "delete"}
        onClose={() => {
          setConfirm("");
          close();
        }}
        title="Delete user"
        description="Permanently deletes the account and everything it owns: projects, targets, campaigns, runs, findings, evidence, devices, and settings. Payment records are kept for accounting, detached from the account. This cannot be undone."
        destructive
        confirmLabel="Delete permanently"
        canSubmit={confirm.trim().toLowerCase() === u.email.toLowerCase()}
        onSubmit={async (reason) => {
          await adminClient.deleteUser(u.id, confirm.trim(), reason);
          deleted();
        }}
      >
        <Field label={`Type ${u.email} to confirm`} htmlFor="adm-del">
          <Input id="adm-del" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </Field>
      </ActionDialog>

      <ActionDialog
        open={kind === "refund"}
        onClose={close}
        title="Refund payment"
        description={action?.kind === "refund" ? `Refunds invoice ${action.number} (${formatCurrency(action.amount, "INR")}) in full through Razorpay and takes back the time it bought. Any credit used on it is returned.` : ""}
        destructive
        confirmLabel="Refund in full"
        onSubmit={async (reason) => {
          if (action?.kind !== "refund") return;
          await adminClient.refund(u.id, action.paymentId, reason);
          done("Refund issued");
        }}
      />

      <ActionDialog
        open={kind === "revoke"}
        onClose={close}
        title="Revoke device"
        description={action?.kind === "revoke" ? `"${action.name}" can no longer sync or fetch entitlements. The user can sign it in again with modelwrecker login.` : ""}
        destructive
        confirmLabel="Revoke"
        onSubmit={async (reason) => {
          if (action?.kind !== "revoke") return;
          await adminClient.revokeDevice(u.id, action.deviceId, reason);
          done("Device revoked");
        }}
      />
    </>
  );
}
