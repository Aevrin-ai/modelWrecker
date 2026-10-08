import { useEffect, useState } from "react";
import { animate } from "motion/react";

// How far through typing a line a mockup is, from 0 to 1, while `active`.
export function useTyping(active: boolean, duration = 1.2) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!active) return;
    const controls = animate(0, 1, { duration, ease: "linear", onUpdate: setProgress });
    return () => controls.stop();
  }, [active, duration]);
  return active ? progress : 0;
}
