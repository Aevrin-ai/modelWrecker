import { useReducedMotion } from "motion/react";

import { useMediaQuery } from "@/hooks/use-media-query";
import { FinalFrame } from "./final-frame";
import { MovingStory } from "./moving-story";
import { StillStory } from "./still-story";

// the story told as you scroll on wide screens, a still final frame below lg, plain sections for reduced motion
export function Story() {
  const reduce = useReducedMotion();
  const wide = useMediaQuery("(min-width: 64rem)");

  let content = <FinalFrame />;
  if (reduce) {
    content = <StillStory />;
  } else if (wide) {
    content = <MovingStory />;
  }

  return (
    <section id="story" aria-labelledby="story-heading" className="bg-background relative">
      {content}
    </section>
  );
}
