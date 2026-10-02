// Plan configuration. Mirrors src/dash/src/lib/plans.ts; in http mode the dashboard reads plans from
// this route, so this file is the server-side source. Limits are placeholders until billing config
// (Razorpay, ROADMAP 10.13) sets them. No price is invented here.

export const PLANS = [
  {
    id: "free",
    name: "Free",
    blurb: "Local engine, core strategies, basic dashboard. Fully usable with free, self-hosted parts.",
    priceLabel: "Free",
    limits: { campaigns: 5, attacks: 1000, devices: 1, projects: 2 },
    features: { advanced_strategies: false, mcp: false, analytics: false, evidence_storage: false, enterprise: false },
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "More campaigns and devices, advanced strategies, MCP targets, richer analytics.",
    priceLabel: "Set in billing config",
    highlighted: true,
    limits: { campaigns: 50, attacks: 25000, devices: 10, projects: 25 },
    features: { advanced_strategies: true, mcp: true, analytics: true, evidence_storage: true, enterprise: false },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    blurb: "Organizations, policy controls, audit logs, SSO, compliance.",
    priceLabel: "Contact sales",
    limits: { campaigns: null, attacks: null, devices: null, projects: null },
    features: { advanced_strategies: true, mcp: true, analytics: true, evidence_storage: true, enterprise: true },
  },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];

export function planById(id: string) {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
