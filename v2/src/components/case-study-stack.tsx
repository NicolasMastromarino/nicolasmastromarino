"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { cityBus } from "@/components/city/city-bus";
import { CaseStudyDiagram } from "@/components/case-study-diagram";
import { EASE_OUT } from "@/components/motion-primitives";

export type CaseStudy = {
  id: string;
  ticket: string;
  title: string;
  context: string;
  work: string;
  outcome: string;
};

type Labels = { context: string; work: string; outcome: string; download: string };

function StackCard({
  item,
  index,
  total,
  pdf,
  labels,
  progress,
  stacked,
}: {
  item: CaseStudy;
  index: number;
  total: number;
  pdf?: string;
  labels: Labels;
  progress: MotionValue<number>;
  stacked: boolean;
}) {
  // Each card shrinks slightly as the next one slides over it.
  const target = 1 - (total - index) * 0.035;
  const scale = useTransform(progress, [index / total, 1], stacked ? [1, target] : [1, 1]);
  const shade = useTransform(progress, [index / total, 1], stacked ? [0, 0.6] : [0, 0]);

  return (
    <div
      id={`case-${index}`}
      className={`[@media(min-height:780px)]:lg:sticky ${index === 0 ? "fade-rise" : ""}`}
      style={{ top: `calc(6rem + ${index * 18}px)`, ...(index === 0 ? { animationDelay: "0.45s" } : null) }}
    >
      <motion.article
        style={{ scale, transformOrigin: "50% 0%" }}
        // the first card is already on screen when the page opens, so it plays on first paint (CSS) instead of waiting for a scroll
        {...(index === 0
          ? {}
          : {
              initial: { y: 40, opacity: 0 },
              whileInView: { y: 0, opacity: 1 },
              viewport: { once: true, margin: "0px 0px -8% 0px" },
              transition: { duration: 0.7, ease: EASE_OUT },
            })}
        className="relative overflow-hidden rounded-[var(--radius-lg)] border border-line-strong bg-surface p-7 shadow-[var(--shadow)] sm:p-9"
      >
        <motion.div
          aria-hidden="true"
          style={{ opacity: shade }}
          className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] bg-bg"
        />
        <span
          aria-hidden="true"
          className="outline-text pointer-events-none absolute -right-2 -top-6 select-none font-display text-[9rem] font-extrabold leading-none opacity-60"
        >
          {String(index + 1).padStart(2, "0")}
        </span>

        <span className="relative font-mono text-[11.5px] uppercase tracking-[0.12em] text-accent-2">
          {item.ticket}
        </span>
        <h2 className="relative mt-2.5 max-w-[26ch] text-[1.5rem] leading-snug sm:text-[1.9rem]">
          {item.title}
        </h2>

        <div className="relative mt-6 rounded-[var(--radius-md)] border border-line bg-bg/60 p-3 sm:p-5">
          <CaseStudyDiagram variant={item.id} />
        </div>

        <dl className="relative mt-7 grid gap-6 border-t border-line pt-7 sm:grid-cols-3 lg:grid-cols-1">
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
              {labels.context}
            </dt>
            <dd className="mt-2 text-[14px] leading-relaxed text-ink-soft">{item.context}</dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
              {labels.work}
            </dt>
            <dd className="mt-2 text-[14px] leading-relaxed text-ink-soft">{item.work}</dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-wide text-accent-text">
              {labels.outcome}
            </dt>
            <dd className="mt-2 text-[14px] leading-relaxed text-ink">{item.outcome}</dd>
          </div>
        </dl>

        {pdf && (
          <a
            href={pdf}
            target="_blank"
            rel="noopener noreferrer"
            className="link-draw relative mt-6 inline-flex items-center gap-2 pb-0.5 text-sm font-medium text-accent-text no-underline"
          >
            {labels.download} ↓
          </a>
        )}
      </motion.article>
    </div>
  );
}

export function CaseStudyStack({
  items,
  pdfById,
  labels,
}: {
  items: CaseStudy[];
  pdfById: Record<string, string>;
  labels: Labels;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  // Tell the 3D city which case study is on screen so the camera flies to it.
  const { scrollYProgress: cueProgress } = useScroll({ target: ref, offset: ["start 75%", "end 25%"] });
  useMotionValueEvent(cueProgress, "change", (v) => {
    if (v < 0 || v > 1) cityBus.clear(cityBus.cue);
    else cityBus.set(`case-${Math.min(items.length - 1, Math.floor(v * items.length))}`);
  });
  useEffect(() => () => cityBus.set(""), []);
  // Cards only pin (and shrink under the next one) when there is room for it.
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (min-height: 780px)");
    const update = () => setStacked(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div ref={ref} className="flex flex-col gap-6 lg:gap-10">
      {items.map((item, i) => (
        <StackCard
          key={item.id}
          item={item}
          index={i}
          total={items.length}
          pdf={pdfById[item.id]}
          labels={labels}
          progress={scrollYProgress}
          stacked={stacked}
        />
      ))}
    </div>
  );
}
