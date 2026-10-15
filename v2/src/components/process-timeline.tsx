"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform, useInView } from "motion/react";
import { EASE_OUT } from "@/components/motion-primitives";

type Step = { title: string; desc: string };

function StepRow({ step, index, last }: { step: Step; index: number; last: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  return (
    <div ref={ref} className="relative grid grid-cols-[auto_1fr] gap-x-6 sm:gap-x-9">
      <div className="relative flex w-10 justify-center">
        <span
          className={`relative z-10 mt-1 flex h-10 w-10 items-center justify-center rounded-full border font-mono text-xs transition-[transform,background-color,border-color,color] duration-300 ease-out-strong ${
            inView
              ? "scale-110 border-accent bg-accent text-accent-ink"
              : "border-line-strong bg-surface-2 text-ink-soft"
          }`}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "0px 0px -10% 0px" }}
        transition={{ duration: 0.65, ease: EASE_OUT }}
        className={last ? "" : "pb-14"}
      >
        <h3 className="text-[1.35rem] sm:text-[1.6rem]">{step.title}</h3>
        <p className="mt-2.5 max-w-[56ch] text-[0.98rem] leading-relaxed text-ink-soft">
          {step.desc}
        </p>
      </motion.div>
    </div>
  );
}

/** Vertical process: the rail fills as you scroll, the current step lights up. */
export function ProcessTimeline({ steps }: { steps: Step[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 65%", "end 55%"],
  });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 28, restDelta: 0.001 });
  const height = useTransform(fill, [0, 1], ["0%", "100%"]);

  return (
    <div ref={ref} className="relative">
      <div
        aria-hidden="true"
        className="absolute bottom-5 left-5 top-5 w-px -translate-x-1/2 bg-line-strong"
      />
      <motion.div
        aria-hidden="true"
        style={{ height }}
        className="absolute left-5 top-5 w-[2px] -translate-x-1/2 bg-gradient-to-b from-accent via-accent to-accent-2"
      />
      <div>
        {steps.map((step, i) => (
          <StepRow key={step.title} step={step} index={i} last={i === steps.length - 1} />
        ))}
      </div>
    </div>
  );
}
