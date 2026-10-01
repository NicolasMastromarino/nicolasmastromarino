"use client";

import { useEffect, useRef, useState } from "react";

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
  const { prefix, number, decimals, suffix } = parseStatValue(value);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!animate || number === null) return;
    const duration = 1200;
    const start = performance.now();
    let frame: number;

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(number! * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, number]);

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
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimate(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="mt-11 flex flex-wrap gap-x-6 gap-y-4 border-t border-line pt-6">
      {stats.map((stat) => (
        <div key={stat.label} className="whitespace-nowrap">
          <b className="block font-display text-[1.7rem] font-extrabold text-ink">
            <AnimatedValue value={stat.value} animate={animate} />
          </b>
          <span className="font-mono text-[11.5px] tracking-wide text-ink-faint">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
