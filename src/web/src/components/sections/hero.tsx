import { ArrowRight } from "lucide-react";

import { APP_URL, DEMO_URL } from "@/lib/links";
import { Pill } from "@/components/ui/pill";
import { Scene } from "@/components/ui/scene";
import { HeroFindings } from "@/components/mockups/hero-findings";

/*
  The hero, laid out the way Activepieces lays out theirs: a sky, the promise
  and the button pair over it, and the product itself rising out of the sky
  and dissolving into the page below. Each line rises out of a soft blur on
  load (.hero-line), one after another.
*/

function delay(i: number) {
  return { animationDelay: `${0.12 + i * 0.09}s` };
}

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-heading" className="relative overflow-x-clip">
      <div className="relative isolate overflow-hidden px-5 pt-36 pb-[336px] md:pt-[152px] md:pb-[352px]">
        <Scene name="sky" />
        {/* The bottom of the sky dissolves into the page. */}
        <div aria-hidden="true" className="to-background absolute inset-x-0 bottom-0 h-36 bg-linear-to-b from-transparent" />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-8 text-center">
          <span
            className="hero-line inline-flex items-center gap-2 rounded-full bg-white/70 py-1.5 pr-3.5 pl-1.5 text-sm font-medium text-slate-900 backdrop-blur-md dark:bg-slate-950/50 dark:text-slate-100"
            style={delay(0)}
          >
            <span className="bg-lime rounded-full px-2 py-0.5 text-xs font-semibold text-slate-950">modelWrecker</span>
            by Aevrin
          </span>
          <h1
            id="hero-heading"
            className="hero-line font-heading max-w-[20ch] text-[40px] leading-[1.02] font-bold text-balance text-slate-950 md:text-[72px] dark:text-white"
            style={delay(1)}
          >
            Attack your AI before attackers do.
          </h1>
          <p
            className="hero-line max-w-[48rem] text-base leading-relaxed text-balance text-slate-800 md:text-2xl md:leading-8 dark:text-slate-200"
            style={delay(2)}
          >
            modelWrecker tests the chatbots, agents and AI tools you own or are allowed to test, right on your own
            machine. Every weak spot it finds comes with proof you can replay.
          </p>
          <div className="hero-line flex w-full flex-col gap-3 sm:w-auto sm:flex-row" style={delay(3)}>
            <Pill size="lg" href={APP_URL}>
              Open modelWrecker
              <ArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
            </Pill>
            <Pill size="lg" variant="glass" href={DEMO_URL}>
              Request a demo
            </Pill>
          </div>
          <p className="hero-line text-[15px] text-slate-800 dark:text-slate-300" style={delay(4)}>
            For AI systems you own or are allowed to test.
          </p>
        </div>
      </div>

      {/* The product, pulled up into the sky. Its bottom fades into the page so
          the window dissolves rather than ending in a hard edge. */}
      <div className="max-w-container hero-line relative z-10 -mt-[292px] md:-mt-[308px]" style={delay(5)}>
        <div className="relative aspect-[2/3] overflow-hidden rounded-2xl shadow-[0_0_0_1px_rgb(2_6_23/0.2),0_0_0_6px_rgb(255_255_255/0.55),0_24px_60px_-24px_rgb(2_6_23/0.2)] sm:aspect-[4/3] lg:aspect-[2/1] lg:rounded-3xl dark:shadow-[0_0_0_1px_rgb(255_255_255/0.12),0_0_0_6px_rgb(255_255_255/0.06)]">
          <HeroFindings />
        </div>
        <div aria-hidden="true" className="from-background/0 via-background/80 to-background absolute inset-x-[-48px] -bottom-12 h-[38%] bg-linear-to-b" />
      </div>
    </section>
  );
}
