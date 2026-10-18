import { useEffect, useState } from "react";

// scrolling down hides the bar and any move up brings it back; it never hides near the top
export function useHideOnScroll(locked: boolean) {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setScrolled(scrollY > 8);
      if (Math.abs(scrollY - lastScrollY) < 4) return;
      setHidden(scrollY > lastScrollY && scrollY > 120);
      lastScrollY = scrollY;
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  return { hidden: hidden && !locked, scrolled };
}
