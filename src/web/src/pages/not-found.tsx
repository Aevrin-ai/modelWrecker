import { useEffect } from "react";
import { ArrowRight } from "lucide-react";

import { Pill } from "@/components/ui/pill";
import { Scene } from "@/components/ui/scene";

// Any address this site does not have. Kept out of search results.
export default function NotFound() {
  useEffect(() => {
    document.title = "Page not found - modelWrecker";
    const meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previous = meta?.content;
    if (meta) meta.content = "noindex";
    return () => {
      if (meta && previous) meta.content = previous;
    };
  }, []);

  return (
    <section aria-labelledby="not-found-heading" className="relative isolate overflow-hidden px-5 pt-44 pb-40 text-center">
      <Scene name="mist" />
      <div aria-hidden="true" className="to-background absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-transparent" />
      <div className="relative mx-auto max-w-xl">
        <p className="text-sm font-semibold tracking-[0.08em] text-slate-700 uppercase dark:text-slate-300">404</p>
        <h1 id="not-found-heading" className="font-heading mt-4 text-5xl leading-[1.05] font-bold text-slate-950 md:text-6xl dark:text-white">
          This page is not here.
        </h1>
        <p className="mt-5 text-lg text-slate-800 dark:text-slate-200">The link may be old, or the address may have a typo.</p>
        <div className="mt-8 flex justify-center">
          <Pill to="/">
            Back to the home page
            <ArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
          </Pill>
        </div>
      </div>
    </section>
  );
}
