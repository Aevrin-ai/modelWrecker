import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

import { AEVRIN_MCP_URL, AEVRIN_URL, APP_URL, DEMO_URL, DOCS_URL, GITHUB_URL } from "@/lib/links";
import { CheckItem } from "@/components/ui/check-item";
import { Logo } from "@/components/ui/logo";
import { Pill } from "@/components/ui/pill";
import { Scene } from "@/components/ui/scene";

/*
  The close of the page, the way Activepieces closes theirs: one last ask over
  a painted meadow, then the links on a white card that dissolves into the art
  at the bottom. The meadow is a wide-screen flourish; phones get plain white.
*/

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "What it tests", href: "/#tests" },
      { label: "How a run works", href: "/#how-it-works" },
      { label: "14 ways to attack", href: "/#attacks" },
      { label: "Findings", href: "/#findings" },
      { label: "Pricing", href: "/#pricing" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Docs", href: DOCS_URL },
      { label: "GitHub", href: GITHUB_URL },
      { label: "FAQ", href: "/#faq" },
      { label: "Open the app", href: APP_URL },
    ],
  },
  {
    heading: "Aevrin",
    links: [
      { label: "aevrin.net", href: AEVRIN_URL },
      { label: "Aevrin MCP", href: AEVRIN_MCP_URL },
      { label: "Contact", href: DEMO_URL },
    ],
  },
];

function FooterLink({ href, children }: { href: string; children: string }) {
  const className = "text-foreground hover:text-brand inline-flex min-h-11 items-center text-base transition-colors md:min-h-0";
  if (href.startsWith("/")) {
    return (
      <Link to={href} className={className}>
        {children}
      </Link>
    );
  }
  const sameSite = href.startsWith("https://app.aevrin.net");
  return (
    <a href={href} className={className} {...(sameSite ? {} : { target: "_blank", rel: "noreferrer" })}>
      {children}
    </a>
  );
}

export function Footer() {
  return (
    <footer className="bg-background relative isolate overflow-hidden">
      {/* The meadow fades in from the white page above it. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 hidden h-full md:block"
        style={{ maskImage: "linear-gradient(to bottom, transparent 0%, black 30%, black 100%)" }}
      >
        <Scene name="meadow" />
      </div>

      <div className="max-w-container relative pt-24 pb-10 md:pt-32 md:pb-16">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <h2 className="font-heading text-foreground text-4xl leading-[1.05] font-bold text-balance md:text-5xl">
            Find the weak spots first.
          </h2>
          <p className="text-muted-foreground max-w-xl text-lg leading-relaxed text-pretty md:text-xl md:text-slate-800 md:dark:text-slate-200">
            Run modelWrecker against AI systems you own or are allowed to test.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Pill href={APP_URL}>
              Open modelWrecker
              <ArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
            </Pill>
            <Pill variant="glass" href={DEMO_URL}>
              Request a demo
            </Pill>
          </div>
          <ul className="mt-1 flex flex-wrap justify-center gap-x-5 gap-y-2">
            {["Runs on your machine", "Your own model keys", "Proof for every finding"].map((p) => (
              <CheckItem key={p} className="text-sm font-medium">
                {p}
              </CheckItem>
            ))}
          </ul>
        </div>

        <div
          className="bg-card mt-24 rounded-[32px] p-8 shadow-edge md:mt-32 md:p-12 dark:ring-1 dark:ring-white/10"
          style={{ maskImage: "linear-gradient(to bottom, black calc(100% - 3rem), transparent)" }}
        >
          <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-8">
            <div className="max-w-xs space-y-4">
              <Logo />
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                For authorized testing only. Use modelWrecker only on AI systems you own or are allowed to test.
              </p>
            </div>
            {COLUMNS.map((column) => (
              <nav key={column.heading} aria-label={column.heading}>
                <p className="text-foreground mb-3 text-base font-semibold">{column.heading}</p>
                <ul className="grid grid-cols-2 gap-x-6 md:grid-cols-1 md:gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <FooterLink href={link.href}>{link.label}</FooterLink>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className="text-muted-foreground mt-10 grid gap-3 border-t border-slate-950/10 pt-6 pb-8 text-[15px] md:grid-cols-2 md:items-center dark:border-white/10">
            <a href={AEVRIN_URL} target="_blank" rel="noreferrer" className="hover:text-foreground inline-flex items-center gap-1.5">
              Part of the Aevrin security platform
              <ArrowRight aria-hidden="true" className="size-4" />
            </a>
            <p className="md:text-right">&copy; {new Date().getFullYear()} Aevrin</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
