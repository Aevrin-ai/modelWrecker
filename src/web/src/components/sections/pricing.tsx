import { useState } from "react";

import {
  PLAN_CONFIGS as PLANS,
  TAX_NOTE,
  formatPaise,
  yearlySavingPercent,
  type FeatureKey,
  type Interval,
} from "../../../../shared/plans";
import { cn } from "@/lib/utils";
import { APP_URL, BILLING_URL, DEMO_URL } from "@/lib/links";
import { CheckItem, Section, SectionIntro } from "@/components/ui/blocks";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";

/*
  Prices come from src/shared/plans.json, the same file the API charges from
  and the dashboard shows, so the page can never advertise a price the
  checkout does not use (docs/billing/pricing.md). Nothing here is typed by
  hand: amounts, the yearly saving and the tax note are all read from it.
*/

const count = (v: number | null) => (v === null ? "Unlimited" : new Intl.NumberFormat("en-IN").format(v));

const LIMITS = [
  ["campaigns", "Campaign runs a month"],
  ["attacks", "Attack attempts a month"],
  ["devices", "Devices"],
  ["projects", "Projects"],
] as const;

// Sales wording on purpose. The dashboard's Billing page names the same
// features plainly (FEATURE_LABEL in src/dash/src/lib/plans.ts).
const FEATURES: [FeatureKey, string][] = [
  ["advanced_strategies", "PyRIT-based strategies and garak probes"],
  ["mcp", "MCP targets"],
  ["evidence_storage", "Evidence and transcript sync"],
  ["analytics", "Model leaderboard"],
  ["enterprise", "SSO, policies, audit logs"],
];

export function Pricing() {
  const [interval, setBillingInterval] = useState<Interval>("month");
  const saving = yearlySavingPercent(PLANS.find((p) => p.prices)?.prices ?? null);

  return (
    <Section id="pricing" labelledBy="pricing-heading">
      <SectionIntro
        id="pricing-heading"
        layout="stacked"
        title="Simple, prepaid pricing"
        titleClassName="mx-auto max-w-[16ch]"
        leadClassName="mx-auto max-w-[56ch]"
        className="text-center"
        lead="Start free with the full local engine. Upgrade when you need the advanced strategies, MCP targets, and evidence in the dashboard. Pay by the month or the year; nothing renews on its own."
      />

      <div className="mt-10 flex justify-center md:mt-12">
        <div role="group" aria-label="Billing period" className="bg-muted inline-flex rounded-full p-1 text-[15px]">
          {(["month", "year"] as const).map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={interval === i}
              onClick={() => setBillingInterval(i)}
              className={cn(
                "focus-visible:ring-ring inline-flex min-h-10 items-center gap-2 rounded-full px-5 font-medium transition-[background-color,color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:outline-none",
                interval === i ? "bg-card text-foreground shadow-edge" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {i === "month" ? "Monthly" : "Yearly"}
              {i === "year" && saving > 0 && (
                <span className="bg-lime rounded-full px-2 py-0.5 text-[12px] font-semibold text-slate-950">save {saving}%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {PLANS.map((p, idx) => {
          const price = p.prices?.[interval];
          return (
            <Reveal
              key={p.id}
              as="article"
              delay={idx * 0.06}
              y={16}
              className={cn(
                "bg-card flex h-full flex-col rounded-2xl p-7 shadow-edge dark:ring-1 dark:ring-white/10",
                p.highlighted && "ring-primary ring-2 dark:ring-2 dark:ring-lime",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-foreground text-xl font-semibold">{p.name}</h3>
                {p.highlighted && (
                  <span className="bg-lime rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-slate-950">Recommended</span>
                )}
              </div>
              <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed text-pretty lg:min-h-[4.5rem]">{p.blurb}</p>

              <p className="font-heading text-foreground mt-6 text-5xl leading-none font-bold">
                {p.id === "free" ? formatPaise(0) : price ? formatPaise(price) : "Custom"}
                {price && <span className="text-muted-foreground font-sans text-base font-normal"> / {interval}</span>}
              </p>
              <p className="text-muted-foreground mt-2 min-h-5 text-[13px]">
                {price && interval === "year" ? `${formatPaise(price / 12)} a month, billed yearly` : p.prices ? TAX_NOTE : ""}
              </p>

              <dl className="border-border mt-6 space-y-2.5 border-t pt-6 text-[15px]">
                {LIMITS.map(([key, label]) => (
                  <div key={key} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-foreground font-medium tabular-nums">{count(p.limits[key])}</dd>
                  </div>
                ))}
              </dl>

              <ul className="mt-6 space-y-3">
                <CheckItem>Local engine, core strategies, any model</CheckItem>
                {FEATURES.filter(([k]) => p.features[k]).map(([k, label]) => (
                  <CheckItem key={k}>{label}</CheckItem>
                ))}
              </ul>

              <div className="mt-auto pt-8">
                {p.id === "enterprise" ? (
                  <Pill variant="outline" href={DEMO_URL} className="w-full">
                    Contact us
                  </Pill>
                ) : (
                  <Pill variant={p.highlighted ? "primary" : "outline"} href={p.prices ? BILLING_URL : APP_URL} className="w-full">
                    {p.prices ? `Get ${p.name}` : "Start free"}
                  </Pill>
                )}
              </div>
            </Reveal>
          );
        })}
      </div>

      <p className="text-muted-foreground mt-8 text-center text-[13px] text-pretty">
        Payments by Razorpay. Prices are in Indian rupees. {TAX_NOTE} The engine runs on your machine on every plan.
      </p>
    </Section>
  );
}
