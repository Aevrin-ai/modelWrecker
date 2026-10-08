import { Suspense, lazy, useEffect } from "react";

import { useHydrated } from "@/hooks/use-hydrated";
import { Hero } from "@/components/sections/hero";

// Everything under the hero loads as its own chunk, so the first paint only
// waits for the hero. The prerendered HTML holds just its placeholder; the
// chunk starts loading once the page is live in the browser.
const BelowFold = lazy(() => import("@/components/sections/below-fold"));

const TITLE = "modelWrecker by Aevrin: attack your AI before attackers do";

const placeholder = <div className="min-h-svh" />;

export function Home() {
  const hydrated = useHydrated();
  useEffect(() => {
    document.title = TITLE;
  }, []);
  return (
    <>
      <Hero />
      {hydrated ? (
        <Suspense fallback={placeholder}>
          <BelowFold />
        </Suspense>
      ) : (
        placeholder
      )}
    </>
  );
}
