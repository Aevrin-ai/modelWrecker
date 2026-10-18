import type { ReactNode } from "react";

export interface CodeBlockProps {
  label: string;
  right?: ReactNode;
  children: ReactNode;
}

export function CodeBlock({ label, right, children }: CodeBlockProps) {
  return (
    <div>
      <div className="mb-1.5 flex h-5 items-center gap-2">
        <span className="text-[12px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</span>
        {right}
      </div>
      <div className="font-mono text-[14px] leading-[1.7] break-words">{children}</div>
    </div>
  );
}
