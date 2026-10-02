import { ArrowUpRight, Github, Globe } from "lucide-react";
import { Logo } from "../components/Logo";
import { Reveal } from "../components/Reveal";
import { Button } from "../components/Button";
import { cta, footer } from "../data/content";
import { DASHBOARD_URL, GITHUB_URL } from "../data/navigation";

// Folio footer: a full-bleed landscape photo with a centered serif CTA, and a
// rounded dark link panel floating over the bottom of the photo.
export function Footer() {
  return (
    <footer className="relative mt-12 overflow-hidden bg-background">
      <div className="absolute inset-0" aria-hidden>
        <img src="/images/cta-bg.jpg" alt="" loading="lazy" className="size-full object-cover object-[30%_60%]" />
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/45 to-background/30" />
      </div>

      <div className="relative px-6 pb-16 pt-40 text-center md:pt-56">
        <Reveal>
          <h2 className="h-section mx-auto max-w-4xl text-balance text-5xl text-foreground md:text-7xl">{cta.title}</h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mx-auto mt-6 max-w-lg text-balance text-lg text-foreground/75">{cta.body}</p>
        </Reveal>
        <Reveal delay={0.16}>
          <div className="mt-10">
            <Button href={DASHBOARD_URL} size="pill">
              {cta.button}
            </Button>
          </div>
        </Reveal>
      </div>

      <div className="relative mx-auto max-w-[1400px] px-4 pb-6 pt-24 md:px-10 md:pt-40">
        <div className="rounded-3xl border border-border bg-panel/95 p-8 backdrop-blur md:p-12">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <Logo size={34} wordClassName="text-2xl" />
              <p className="mt-6 max-w-sm leading-relaxed text-muted">{footer.blurb}</p>
              <a
                href="https://aevrin.net"
                target="_blank"
                rel="noreferrer noopener"
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium"
              >
                <Globe className="size-4" /> aevrin.net
              </a>
              <div className="mt-6 flex gap-3">
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="GitHub"
                  className="flex size-11 items-center justify-center rounded-lg border border-border bg-background hover:bg-elevated"
                >
                  <Github className="size-5" />
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-10 md:grid-cols-4 lg:col-span-8">
              {footer.columns.map((col) => (
                <div key={col.title}>
                  <h4 className="font-semibold">{col.title}</h4>
                  <ul className="mt-6 space-y-4">
                    {col.links.map((l) => {
                      const external = "external" in l && l.external;
                      return (
                        <li key={l.label}>
                          <a
                            href={l.href}
                            {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                            className="inline-flex items-center gap-1 text-muted transition-colors hover:text-foreground"
                          >
                            {l.label}
                            {external && <ArrowUpRight className="size-3.5" />}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-14 flex flex-col justify-between gap-4 border-t border-border pt-8 text-sm text-muted md:flex-row">
            <p>&copy; {new Date().getFullYear()} Aevrin. Built on the ModelWrecker engine.</p>
            <p>Apache-2.0 (planned)</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
