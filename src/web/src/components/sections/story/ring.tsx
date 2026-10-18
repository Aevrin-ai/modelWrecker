import { useRef } from "react";
import type { MotionValue } from "motion/react";

import { STEPS } from "./steps";
import { SHOW } from "./ring-places";
import { RingNode } from "./ring-node";
import { RingWire } from "./ring-wire";
import { useRingLayout } from "./use-ring-layout";

export interface RingProps {
  progress: MotionValue<number>;
}

// what the windows collapse into: the nine steps of a run in a U, mirrored so it never implies a loop
export function Ring({ progress }: RingProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Partial<Record<string, HTMLDivElement | null>>>({});
  const layout = useRingLayout(boxRef, nodeRefs);
  return (
    <div ref={boxRef} aria-hidden="true" className="absolute inset-x-0 top-[14%] bottom-[4.5%] hidden lg:block">
      {layout && (
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="absolute inset-0 size-full overflow-visible"
          focusable="false"
        >
          {layout.wires.map((wire, i) => (
            <RingWire key={i} wire={wire} progress={progress} />
          ))}
        </svg>
      )}
      {STEPS.map((step, i) => (
        <RingNode
          key={step.id}
          step={step}
          show={SHOW[i]}
          progress={progress}
          nodeRef={(node) => {
            nodeRefs.current[step.id] = node;
          }}
        />
      ))}
    </div>
  );
}
