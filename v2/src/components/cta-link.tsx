"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { NavLink } from "@/components/nav-link";

const STYLES = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  ghost: "border border-line-strong bg-white/[0.03] text-ink hover:bg-white/[0.08]",
  dark: "bg-ink text-bg hover:bg-white",
} as const;

/**
 * Pill button with a magnetic pull toward the cursor. The pull is decorative,
 * so it runs through a spring (feels alive) and is only wired for fine pointers.
 */
export function CtaLink({
  href,
  variant = "primary",
  children,
  external,
}: {
  href: string;
  variant?: keyof typeof STYLES;
  children: ReactNode;
  external?: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });

  function onMove(e: React.PointerEvent) {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.22);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.32);
  }
  function onLeave() {
    x.set(0);
    y.set(0);
  }

  const cls = `press group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full px-6 py-3.5 text-[14.5px] font-semibold no-underline ${STYLES[variant]}`;
  const inner = (
    <>
      <span className="relative z-10">{children}</span>
      <span
        aria-hidden="true"
        className="relative z-10 inline-block transition-transform duration-300 ease-out-strong group-hover:translate-x-1"
      >
        →
      </span>
    </>
  );

  return (
    <motion.span
      ref={ref}
      style={{ x: sx, y: sy }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="inline-block"
    >
      {external ? (
        <a href={href} className={cls}>
          {inner}
        </a>
      ) : (
        <NavLink href={href} className={cls}>
          {inner}
        </NavLink>
      )}
    </motion.span>
  );
}
