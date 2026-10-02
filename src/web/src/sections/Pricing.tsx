import { useState } from "react";
import { Check } from "lucide-react";
import config from "../../../shared/plans.json";
import { Container } from "../components/Container";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal } from "../components/Reveal";
import { Button } from "../components/Button";
import { cn } from "../lib/cn";
import { DASHBOARD_URL } from "../data/navigation";

// Prices come from src/shared/plans.json, the same file the API charges from and the dashboard shows,
// so the landing page can never advertise a price the checkout does not use (docs/billing/pricing.md).

type Interval = "month" | "year";

interface PlanConfig {
  id: string;
  name: string;
  blurb: string;
  highlighted?: boolean;
  limits: Record<string, number | null>;
  features: Record<string, boolean>;
  prices: Record<Interval, number> | null;
}

const PLANS = config.plans as PlanConfig[];

const rupees = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: config.currency, maximumFractionDigits: 0 }).format(paise / 100);

const n = (v: number | null) => (v === null ? "Unlimited" : new Intl.NumberFormat("en-IN").format(v));

const FEATURES: [string, string][] = [
  ["advanced_strategies", "PyRIT and garak strategies"],
  ["mcp", "MCP targets"],
  ["evidence_storage", "Evidence and transcript sync"],
  ["analytics", "Model leaderboard"],
  ["enterprise", "SSO, policies, audit logs"],
];

export function Pricing() {
  const [interval, setBillingInterval] = useState<Interval>("month");
  const pro = PLANS.find((p) => p.prices);
  const saving = pro?.prices ? Math.round((1 - pro.prices.year / (pro.prices.month * 12)) * 100) : 0;

  return (
    <section id="pricing" className="scroll-mt-24 py-20 md:py-28">
      <Container>
        <SectionHeader
          title="Simple, prepaid pricing"
          description="Start free with the full local engine. Upgrade when you need the advanced strategies, MCP targets, and evidence in the dashboard. Pay by the month or the year; nothing renews on its own."
        />
        <div className="mt-10 flex justify-center md:mt-14">
          <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-full border border-border p-1 text-sm">
            {(["month", "year"] as const).map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={interval === i}
                onClick={() => setBillingInterval(i)}
                className={cn(
                  "rounded-full px-4 py-1.5 transition-colors",
                  interval === i ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"
                )}
              >
                {i === "month" ? "Monthly" : "Yearly"}
                {i === "year" && saving > 0 && <span className="ml-1 opacity-80">save {saving}%</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {PLANS.map((p, idx) => {
            const price = p.prices?.[interval];
            return (
              <Reveal key={p.id} delay={idx * 0.05}>
                <div
                  className={cn(
                    "flex h-full flex-col rounded-2xl border bg-background p-6",
                    p.highlighted ? "border-foreground/60" : "border-border"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{p.name}</h3>
                    {p.highlighted && <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">Most popular</span>}
                  </div>
                  <p className="mt-2 min-h-[3rem] text-sm leading-relaxed text-muted">{p.blurb}</p>
                  <p className="mt-6 text-4xl font-semibold tracking-tight">
                    {p.id === "free" ? "₹0" : price ? rupees(price) : "Custom"}
                    {price && <span className="text-base font-normal text-muted"> / {interval}</span>}
                  </p>
                  <p className="mt-1 h-5 text-xs text-muted">
                    {price && interval === "year" ? `${rupees(price / 12)} a month, billed yearly` : p.prices ? config.taxNote : ""}
                  </p>
                  <ul className="mt-6 space-y-2 text-sm">
                    <li className="flex justify-between"><span className="text-muted">Campaign runs a month</span><span>{n(p.limits.campaigns)}</span></li>
                    <li className="flex justify-between"><span className="text-muted">Attack attempts a month</span><span>{n(p.limits.attacks)}</span></li>
                    <li className="flex justify-between"><span className="text-muted">Devices</span><span>{n(p.limits.devices)}</span></li>
                    <li className="flex justify-between"><span className="text-muted">Projects</span><span>{n(p.limits.projects)}</span></li>
                  </ul>
                  <ul className="mt-6 space-y-2 text-sm">
                    <li className="flex items-center gap-2"><Check className="size-4" /> Local engine, core strategies, any model</li>
                    {FEATURES.filter(([k]) => p.features[k]).map(([k, label]) => (
                      <li key={k} className="flex items-center gap-2"><Check className="size-4" /> {label}</li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-8">
                    {p.id === "enterprise" ? (
                      <Button href="https://aevrin.net" variant="outline" size="lg" className="w-full" target="_blank" rel="noreferrer">
                        Contact us
                      </Button>
                    ) : (
                      <Button href={p.prices ? `${DASHBOARD_URL}billing` : DASHBOARD_URL} variant={p.highlighted ? "primary" : "outline"} size="lg" className="w-full">
                        {p.prices ? `Get ${p.name}` : "Start free"}
                      </Button>
                    )}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          Payments by Razorpay. Prices in Indian rupees and include 18% GST. The engine and your evidence stay on your machine on every plan.
        </p>
      </Container>
    </section>
  );
}
