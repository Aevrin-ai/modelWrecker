import { Suspense, lazy, useEffect } from "react";

import { useHydrated } from "@/hooks/use-hydrated";
import { Hero } from "@/components/sections/hero";

// everything under the hero is its own chunk loaded in the browser, so the first paint only waits for the hero
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
