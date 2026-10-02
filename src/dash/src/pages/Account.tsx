import { useEffect, useState } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DataState, SkeletonCards } from "@/components/States";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, humanize } from "@/lib/format";

export function Account() {
  const { toast } = useToast();
  const { signOut } = useAuth();
  const account = useAsync(() => apiClient.getAccount(), []);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account.data) setName(account.data.name);
  }, [account.data]);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await apiClient.updateAccount({ name: name.trim() });
      toast({ title: "Profile updated" });
      account.refetch();
    } catch {
      toast({ title: "Could not update your profile", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Account" description="Your profile and how you sign in." />
      <DataState
        loading={account.loading}
        error={account.error}
        data={account.data}
        onRetry={account.refetch}
        errorTitle="Unable to load your account."
        skeleton={<SkeletonCards count={2} className="lg:grid-cols-2" />}
      >
        {(a) => (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Shown to people in your organization.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-4">
                  <Avatar initials={a.avatarInitials} className="size-14 text-base" />
                  <div>
                    <p className="font-semibold">{a.name}</p>
                    <p className="text-sm text-muted-foreground">{a.email}</p>
                  </div>
                </div>
                <Field label="Display name" htmlFor="account-name">
                  <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Email" htmlFor="account-email" hint="Managed by your Google account.">
                  <Input id="account-email" value={a.email} disabled />
                </Field>
              </CardContent>
              <CardFooter className="justify-end">
                <Button onClick={save} disabled={saving || !name.trim() || name.trim() === a.name}>
                  Save changes
                </Button>
              </CardFooter>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sign-in</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider</span>
                    <span className="font-medium">Google</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Organization</span>
                    <span className="font-medium">{a.organization}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role</span>
                    <Badge>{humanize(a.role)}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Member since</span>
                    <span className="font-medium">{formatDate(a.createdAt)}</span>
                  </div>
                  <p className="flex items-start gap-2 pt-2 text-xs text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                    Aevrin never stores your Google password, and your Google token never reaches a local engine.
                  </p>
                </CardContent>
              </Card>
              <Button variant="outline" className="w-full" onClick={() => void signOut()}>
                <LogOut /> Sign out
              </Button>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
