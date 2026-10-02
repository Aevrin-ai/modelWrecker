import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "../components/Logo";
import { Button } from "../components/Button";
import { cn } from "../lib/cn";
import { navLinks, DASHBOARD_URL } from "../data/navigation";

// Folio nav: a wide transparent bar at the top that shrinks into a floating,
// blurred, bordered rounded bar once the page scrolls.
export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header>
      <nav className="fixed z-50 w-full px-2">
        <div
          className={cn(
            "mx-auto mt-2 px-6 transition-all duration-300 lg:px-12",
            scrolled || open
              ? "max-w-4xl rounded-2xl border border-border bg-background/50 backdrop-blur-lg lg:px-5"
              : "max-w-6xl border border-transparent"
          )}
        >
          <div className="relative flex items-center justify-between gap-6 py-3 lg:py-4">
            <a href="#top" aria-label="Aevrin home" className="flex items-center">
              <Logo size={26} wordClassName="text-[17px]" />
            </a>

            <ul className="absolute inset-x-0 mx-auto hidden w-fit items-center gap-8 text-[15px] lg:flex">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-muted transition-colors hover:text-foreground">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="hidden items-center gap-3 lg:flex">
              {!scrolled && (
                <Button href={DASHBOARD_URL} variant="outline" size="md">
                  Sign in
                </Button>
              )}
              <Button href={DASHBOARD_URL} size="md">
                {scrolled ? "Get started" : "Open the app"}
              </Button>
            </div>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="relative z-20 -m-2.5 block p-2.5 lg:hidden"
            >
              {open ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
          </div>

          {open && (
            <div className="mb-4 space-y-6 border-t border-border pt-6 lg:hidden">
              <ul className="space-y-5 text-base">
                {navLinks.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="text-muted hover:text-foreground"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-3">
                <Button href={DASHBOARD_URL} variant="outline" size="lg">
                  Sign in
                </Button>
                <Button href={DASHBOARD_URL} size="lg">
                  Get started
                </Button>
              </div>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
