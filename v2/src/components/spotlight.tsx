"use client";

import { useCallback, type PointerEvent, type ReactNode } from "react";
import { NavLink } from "@/components/nav-link";

/** Writes the cursor position into --mx/--my so .spot::before can follow it. */
function useSpot() {
  return useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }, []);
}

export function SpotCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const onMove = useSpot();
  return (
    <div onPointerMove={onMove} className={`spot ${className}`}>
      {children}
    </div>
  );
}

export function SpotLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const onMove = useSpot();
  return (
    <NavLink href={href} onPointerMove={onMove} className={`spot no-underline ${className}`}>
      {children}
    </NavLink>
  );
}
