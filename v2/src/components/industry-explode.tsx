"use client";

import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { Icon } from "@/components/industry-icon";
import type { IconName } from "@/components/city/industries";

type Part = { icon: IconName; title: string; text: string };

/** how far apart the pieces end up, in drawing units */
const GAP = 92;
/** the figure's horizontal centre in the 600 x 580 drawing */
const CX = 300;

/** darker (f < 1) or lighter (f > 1) version of a colour */
function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** an isometric box: (cx, cy) is the centre of its top face, w and d the footprint, h the height */
function IsoBox({ cx, cy, w, d, h, base, louvers, accent }: { cx: number; cy: number; w: number; d: number; h: number; base: string; louvers?: boolean; accent?: string }) {
  const a = 0.433;
  const b = 0.25;
  const A: [number, number] = [cx + a * (w - d), cy + b * (w + d)];
  const B: [number, number] = [cx + a * (w + d), cy + b * (w - d)];
  const C: [number, number] = [cx - a * (w - d), cy - b * (w + d)];
  const D: [number, number] = [cx - a * (w + d), cy - b * (w - d)];
  const pts = (...p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const lines: ReactNode[] = [];
  if (louvers) {
    for (let k = 1; k < 10; k++) {
      const t = k / 10;
      const lx = D[0] + (A[0] - D[0]) * t;
      const ly = D[1] + (A[1] - D[1]) * t;
      lines.push(<line key={`l${k}`} x1={lx} y1={ly + 7} x2={lx} y2={ly + h - 7} stroke={shade(base, 0.7)} strokeWidth="2.4" strokeLinecap="round" />);
      const rx = A[0] + (B[0] - A[0]) * t;
      const ry = A[1] + (B[1] - A[1]) * t;
      lines.push(<line key={`r${k}`} x1={rx} y1={ry + 7} x2={rx} y2={ry + h - 7} stroke={shade(base, 0.55)} strokeWidth="2.4" strokeLinecap="round" />);
    }
  }
  return (
    <g strokeLinejoin="round">
      <polygon points={pts(D, A, [A[0], A[1] + h], [D[0], D[1] + h])} fill={shade(base, 0.82)} />
      <polygon points={pts(A, B, [B[0], B[1] + h], [A[0], A[1] + h])} fill={shade(base, 0.62)} />
      <polygon points={pts(C, B, A, D)} fill={shade(base, 1.12)} />
      {lines}
      {accent && <polyline points={pts(D, A, B)} fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />}
    </g>
  );
}

/** draws in the top plane of a box: x and z of the plane map to the isometric axes */
function Plane({ cx, cy, children }: { cx: number; cy: number; children: ReactNode }) {
  return <g transform={`translate(${cx} ${cy}) matrix(0.866 0.5 -0.866 0.5 0 0)`}>{children}</g>;
}

type LayerSpec = { w: number; d: number; h: number; base: string; louvers?: boolean; accent?: boolean };

/** the four pieces of the unit, bottom to top, for each look */
function layersFor(variant: "hvac" | "stack", color: string): LayerSpec[] {
  if (variant === "hvac") {
    return [
      { w: 176, d: 176, h: 26, base: "#59607a", accent: true },
      { w: 150, d: 150, h: 74, base: "#9aa4b8", louvers: true },
      { w: 150, d: 150, h: 20, base: "#7f8aa3", accent: true },
      { w: 150, d: 150, h: 12, base: "#aab2c4" },
    ];
  }
  return [
    { w: 180, d: 180, h: 34, base: shade(color, 0.5), accent: true },
    { w: 160, d: 160, h: 34, base: shade(color, 0.62), accent: true },
    { w: 140, d: 140, h: 34, base: shade(color, 0.76), accent: true },
    { w: 120, d: 120, h: 34, base: shade(color, 0.9), accent: true },
  ];
}

function Layer({ i, spec, rest, explode, color, active, variant }: { i: number; spec: LayerSpec; rest: number; explode: MotionValue<number>; color: string; active: number; variant: "hvac" | "stack" }) {
  const y = useTransform(explode, (e) => -i * GAP * e);
  const isActive = active === i;
  const dim = active >= 0 && !isActive;
  const top = variant === "hvac" && i === 3;
  return (
    <motion.g
      style={{ y, opacity: dim ? 0.5 : 1, filter: isActive ? `drop-shadow(0 0 14px ${color})` : "none", transition: "opacity 0.35s, filter 0.35s" }}
    >
      <IsoBox cx={CX} cy={rest} w={spec.w} d={spec.d} h={spec.h} base={spec.base} louvers={spec.louvers} accent={spec.accent || isActive ? color : undefined} />
      {top && (
        <Plane cx={CX} cy={rest}>
          <circle r="62" fill={shade(spec.base, 0.5)} stroke={shade(spec.base, 0.4)} strokeWidth="3" />
          {[24, 40, 56].map((r) => (
            <circle key={r} r={r} fill="none" stroke={shade(spec.base, 0.78)} strokeWidth="2" />
          ))}
          <g className="origin-center animate-[spin_6s_linear_infinite] motion-reduce:animate-none" style={{ transformBox: "fill-box" }}>
            {[0, 90, 180, 270].map((deg) => (
              <ellipse key={deg} cx="0" cy="-20" rx="9" ry="22" fill={color} opacity="0.85" transform={`rotate(${deg})`} />
            ))}
          </g>
          <circle r="7" fill={shade(spec.base, 1.3)} />
        </Plane>
      )}
      {variant === "hvac" && i === 0 && (
        <Plane cx={CX} cy={rest}>
          <rect x="-58" y="-58" width="116" height="116" rx="8" fill={shade(spec.base, 0.7)} />
          <circle cx="40" cy="40" r="5" fill={color} />
        </Plane>
      )}
      {variant === "stack" && (
        <Plane cx={CX} cy={rest}>
          <circle r={spec.w * 0.28} fill="none" stroke={color} strokeWidth="2.4" opacity="0.8" />
          <circle r={spec.w * 0.1} fill={color} opacity="0.9" />
        </Plane>
      )}
    </motion.g>
  );
}

/**
 * An exploded view of what gets built for a trade: the pieces of a drawing pull apart as the page scrolls, and each one in turn
 * names a thing that is built. It is a drawing, not a 3D scene, so it weighs nothing and works on any phone.
 */
export function IndustryExplode({
  color,
  parts,
  variant,
  title,
  hint,
}: {
  color: string;
  parts: Part[];
  variant: "hvac" | "stack";
  title: string;
  hint: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const explode = useTransform(scrollYProgress, [0.02, 0.3], [0, 1], { clamp: true });
  const [active, setActive] = useState(-1);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const t = (v - 0.32) / 0.66;
    setActive(t < 0 ? -1 : Math.min(parts.length - 1, Math.floor(t * parts.length)));
  });

  const specs = layersFor(variant, color);
  // top face centres at rest, stacking up from the base
  const rest: number[] = [];
  specs.forEach((s, i) => rest.push(i === 0 ? 445 : rest[i - 1] - s.h));
  const staticExplode = useTransform(scrollYProgress, () => 1);
  const ex = reduce ? staticExplode : explode;
  const shown = reduce ? -1 : active;
  const part = shown >= 0 ? parts[shown] : null;

  const figure = (
    <svg viewBox="0 0 600 580" className="h-auto max-h-[64svh] w-full" aria-hidden="true">
      <ellipse cx={CX} cy={rest[0] + specs[0].h + 62} rx="170" ry="46" fill="rgba(0,0,0,0.38)" />
      <motion.line x1={CX} y1="20" x2={CX} y2="560" stroke={color} strokeWidth="1.5" strokeDasharray="5 7" style={{ opacity: useTransform(ex, [0, 1], [0, 0.45]) }} />
      {specs.map((spec, i) => (
        <Layer key={i} i={i} spec={spec} rest={rest[i]} explode={ex} color={color} active={shown} variant={variant} />
      ))}
    </svg>
  );

  if (reduce) {
    return (
      <section aria-hidden="true" className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
        <h2 className="max-w-[22ch] text-[1.9rem] sm:text-[2.7rem]">{title}</h2>
        <div className="mt-8 grid items-center gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="mx-auto w-full max-w-[420px]">{figure}</div>
          <ol className="grid gap-3">
            {parts.map((p, i) => (
              <li key={p.title} className="flex gap-3 rounded-xl border border-line bg-white/[0.04] p-4">
                <span className="font-mono text-[11px] text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[0.95rem] font-semibold text-ink">{p.title}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <div ref={ref} aria-hidden="true" className="relative h-[380svh]">
      <div className="sticky top-0 flex h-svh items-center px-4 pb-6 pt-24 sm:px-8">
        <div className="glass mx-auto grid w-full max-w-5xl items-center gap-4 rounded-[var(--radius-lg)] p-5 sm:p-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,380px)] lg:gap-10">
          <div className="lg:order-2">
            <h2 className="max-w-[20ch] text-[1.5rem] leading-tight sm:text-[2.1rem]">{title}</h2>
            <div className="mt-4 min-h-[11rem]">
              <AnimatePresence mode="wait">
                {part ? (
                  <motion.div
                    key={shown}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                    className="rounded-2xl border bg-white/[0.04] p-4"
                    style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>
                        <Icon name={part.icon} />
                      </span>
                      <span className="font-mono text-[11px] text-ink-faint">{String(shown + 1).padStart(2, "0")} / {String(parts.length).padStart(2, "0")}</span>
                    </div>
                    <p className="mt-3 font-display text-[1.1rem] font-bold leading-snug text-ink">{part.title}</p>
                    <p className="mt-1.5 text-[0.95rem] leading-snug text-ink-soft">{part.text}</p>
                  </motion.div>
                ) : (
                  <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink-faint">
                    {hint}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <div className="mt-3 flex gap-1.5">
              {parts.map((p, i) => (
                <span key={p.title} className="h-1.5 flex-1 rounded-full transition-colors duration-300" style={{ background: i <= shown ? color : "rgba(255,255,255,0.14)" }} />
              ))}
            </div>
          </div>
          <div className="mx-auto w-full max-w-[540px] lg:order-1">{figure}</div>
        </div>
      </div>
    </div>
  );
}
