import type { ReactNode } from "react";

export function LabelDot({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-mono text-[12.5px] font-medium uppercase tracking-[0.12em] text-accent-2 ${className}`}
    >
      <span className="h-[7px] w-[7px] flex-none rounded-full bg-accent" aria-hidden="true" />
      {children}
    </span>
  );
}
