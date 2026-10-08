import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router";

import { sendPageView } from "../../shared/beacon";
import { Navbar } from "@/components/sections/navbar";
import { Footer } from "@/components/sections/footer";

/*
  Every page: the floating navbar, the page, the footer. Section links
  (`/#tests`) scroll to their section, retrying briefly while lazy sections
  below the fold are still loading. Each page view sends the first-party,
  cookie-free beacon (docs/analytics/page-analytics.md).
*/

function useScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const go = () => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (tries++ < 40) {
        timer = setTimeout(go, 50);
      }
    };
    go();
    return () => clearTimeout(timer);
  }, [pathname, hash]);
}

export function Layout() {
  const { pathname } = useLocation();
  useScrollToHash();
  useEffect(() => {
    sendPageView("landing", pathname);
  }, [pathname]);

  return (
    <>
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only z-[60] rounded-full px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <Suspense fallback={<div className="min-h-svh" />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
