import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router";

import { sendPageView } from "../../shared/beacon";
import { Navbar } from "@/components/sections/navbar";
import { Footer } from "@/components/sections/footer";

function useScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    // retries briefly while the lazy sections below the fold are still loading
    const scrollToTarget = () => {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (tries++ < 40) {
        timer = setTimeout(scrollToTarget, 50);
      }
    };
    scrollToTarget();
    return () => clearTimeout(timer);
  }, [pathname, hash]);
}

// every page: the floating navbar, the page, the footer, and one first-party, cookie-free page-view beacon
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
