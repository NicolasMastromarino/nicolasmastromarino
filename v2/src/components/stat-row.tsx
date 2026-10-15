"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/components/motion-primitives";

type Stat = { value: string; label: string };

function parseStatValue(value: string) {
  const match = value.match(/\d+(\.\d+)?/);
  if (!match) return { prefix: value, number: null as number | null, decimals: 0, suffix: "" };
  const idx = match.index ?? 0;
  const decimals = match[0].includes(".") ? match[0].split(".")[1].length : 0;
  return {
    prefix: value.slice(0, idx),
    number: parseFloat(match[0]),
    decimals,
    suffix: value.slice(idx + match[0].length),
  };
}

function AnimatedValue({ value, animate }: { value: string; animate: boolean }) {
  const reduce = useReducedMotion();
  const { prefix, number, decimals, suffix } = parseStatValue(value);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!animate || number === null) return;
    if (reduce) {
      setDisplay(number);
      return;
    }
    const duration = 1500;
    const start = performance.now();
    let frame: number;

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(number! * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, number, reduce]);

  if (number === null) return <>{prefix}</>;

  return (
    <>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </>
  );
}

export function StatRow({ stats }: { stats: Stat[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <div
      ref={ref}
      className="mt-12 grid grid-cols-1 gap-y-5 border-t border-line pt-7 sm:grid-cols-3 sm:gap-x-6"
    >
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 18 }}
          animate={inView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, delay: i * 0.1, ease: EASE_OUT }}
        >
          <b className="font-tabular block font-display text-[2rem] font-extrabold leading-none text-ink sm:text-[2.2rem]">
            <AnimatedValue value={stat.value} animate={inView} />
          </b>
          <span className="mt-2 block font-mono text-[11px] tracking-[0.08em] text-ink-faint">
            {stat.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
