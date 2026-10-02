import { ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "../components/Button";
import { HeroMockup } from "../components/HeroMockup";
import { DASHBOARD_URL, GITHUB_URL } from "../data/navigation";
import { hero } from "../data/content";

// Folio hero: animated badge pill, two-line serif headline, muted subtitle,
// two buttons, a small caption, then the product window over a landscape photo
// that fades into the page.
export function Hero() {
  const reduce = useReducedMotion();
  const enter = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12, filter: "blur(8px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <section id="top" className="relative overflow-hidden bg-background">
      <div className="relative pt-28 md:pt-40">
        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          <motion.a
            {...enter(0)}
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="group relative mx-auto inline-flex items-center gap-2 overflow-hidden rounded-full border border-border bg-background px-5 py-2 text-[15px] text-foreground"
          >
            <span className="pointer-events-none absolute inset-x-0 -bottom-px mx-auto h-px w-1/3 overflow-hidden">
              <span className="badge-glow absolute left-1/2 top-1/2 size-[200px] -translate-x-1/2 -translate-y-1/2" />
            </span>
            <span className="font-medium">{hero.badge}</span>
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </motion.a>

          <motion.h1
            {...enter(0.1)}
            className="h-hero mx-auto mt-6 max-w-4xl text-balance text-4xl text-foreground sm:text-5xl lg:text-6xl"
          >
            {hero.title}
          </motion.h1>

          <motion.p
            {...enter(0.2)}
            className="mx-auto mb-6 mt-4 max-w-2xl text-balance text-lg text-muted lg:text-xl"
          >
            {hero.subtitle}
          </motion.p>

          <motion.div {...enter(0.3)} className="flex items-center justify-center gap-3">
            <Button href={DASHBOARD_URL} size="lg">
              {hero.primaryCta}
            </Button>
            <Button href={GITHUB_URL} target="_blank" rel="noreferrer noopener" variant="outline" size="lg">
              {hero.secondaryCta}
            </Button>
          </motion.div>

          <motion.p {...enter(0.4)} className="mt-6 text-sm text-muted">
            {hero.captionLead}{" "}
            <a href="#engine" className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
              {hero.captionLink}
            </a>
          </motion.p>
        </div>

        {/* Product window over the landscape backdrop */}
        <div className="relative mt-16 md:mt-20">
          <div className="absolute inset-x-0 -top-56 bottom-0 md:-top-72" aria-hidden>
            <img
              src="/images/hero-bg.jpg"
              alt=""
              className="size-full object-cover object-[50%_35%]"
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute inset-0 bg-gradient-to-b from-background from-10% via-background/55 via-45% to-background/5" />
          </div>
          <motion.div
            initial={reduce ? undefined : { opacity: 0, y: 40 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto max-w-[1280px] px-4 pb-24 md:px-6 md:pb-36"
          >
            <HeroMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
