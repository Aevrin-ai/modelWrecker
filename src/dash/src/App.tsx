import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { SkeletonCards } from "@/components/States";
import { ActiveProjectProvider } from "@/hooks/useActiveProject";
import { useAuth } from "@/hooks/useAuth";
import { AuthLoading, SignIn } from "@/pages/SignIn";
import { sendPageView } from "../../shared/beacon";

// Each page is its own chunk so the chart library only loads on pages that use it.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const Overview = page(() => import("@/pages/Overview"), "Overview");
const Analytics = page(() => import("@/pages/Analytics"), "Analytics");
const Findings = page(() => import("@/pages/Findings"), "Findings");
const FindingDetail = page(() => import("@/pages/FindingDetail"), "FindingDetail");
const Reports = page(() => import("@/pages/Reports"), "Reports");
const Projects = page(() => import("@/pages/Projects"), "Projects");
const ProjectDetail = page(() => import("@/pages/ProjectDetail"), "ProjectDetail");
const Targets = page(() => import("@/pages/Targets"), "Targets");
const Campaigns = page(() => import("@/pages/Campaigns"), "Campaigns");
const CampaignDetail = page(() => import("@/pages/CampaignDetail"), "CampaignDetail");
const Devices = page(() => import("@/pages/Devices"), "Devices");
const Connect = page(() => import("@/pages/Connect"), "Connect");
const Billing = page(() => import("@/pages/Billing"), "Billing");
const Settings = page(() => import("@/pages/Settings"), "Settings");
const Account = page(() => import("@/pages/Account"), "Account");
const NotFound = page(() => import("@/pages/NotFound"), "NotFound");

export function App() {
  const { mode, session, loading } = useAuth();
  const { pathname } = useLocation();

  // One page view per route (docs/analytics/page-analytics.md). Ids are stripped on the server.
  useEffect(() => sendPageView("dashboard", `/dashboard${pathname}`), [pathname]);

  // Live API: nothing but the sign-in screen until there is a session. Data providers mount only
  // after sign-in, so no API call is made without a token.
  if (mode === "http") {
    if (loading) return <AuthLoading />;
    if (!session) return <SignIn />;
  }

  return (
    <ActiveProjectProvider>
      <Suspense fallback={<SkeletonCards count={4} className="sm:grid-cols-2 lg:grid-cols-4" />}>
        <Routes>
          {/* Mock mode: a preview of the sign-in screen. Live mode: already signed in. */}
          <Route path="login" element={mode === "mock" ? <SignIn /> : <Navigate to="/" replace />} />
          <Route element={<AppShell />}>
            <Route index element={<Overview />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="findings" element={<Findings />} />
            <Route path="findings/:id" element={<FindingDetail />} />
            <Route path="reports" element={<Reports />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="targets" element={<Targets />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/:id" element={<CampaignDetail />} />
            <Route path="devices" element={<Devices />} />
            <Route path="connect" element={<Connect />} />
            <Route path="billing" element={<Billing />} />
            <Route path="settings" element={<Settings />} />
            <Route path="account" element={<Account />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </ActiveProjectProvider>
  );
}
