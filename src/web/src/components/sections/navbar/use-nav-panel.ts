import { useLayoutEffect, useRef, useState } from "react";

import { menus } from "@/data/nav";

export function useNavPanel(openMenu: string | null) {
  // keeps the last menu while the panel closes, so its contents fade out with it instead of vanishing
  const [shown, setShown] = useState<string | null>(null);
  if (openMenu && openMenu !== shown) setShown(openMenu);
  const menu = menus.find((entry) => entry.id === shown);

  // the height is measured so the panel eases between menus of different sizes instead of jumping
  const contentsRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const contents = contentsRef.current;
    if (!contents) return;
    const observer = new ResizeObserver(() => setHeight(contents.offsetHeight));
    observer.observe(contents);
    return () => observer.disconnect();
  }, []);

  return { shown, menu, contentsRef, height };
}
