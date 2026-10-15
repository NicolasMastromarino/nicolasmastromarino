"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { EASE_OUT } from "@/components/motion-primitives";

/** Photo reveals with a clip-path wipe, then drifts slightly against scroll. */
export function AboutPhoto({ alt }: { alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const drift = useTransform(scrollYProgress, [0, 1], ["-5%", "5%"]);

  return (
    <motion.div
      ref={ref}
      initial={{ clipPath: "inset(0 0 100% 0 round 28px)", opacity: 0 }}
      animate={{ clipPath: "inset(0 0 0% 0 round 28px)", opacity: 1 }}
      transition={{ duration: 1, delay: 0.2, ease: EASE_OUT }}
      className="relative h-72 w-56 flex-none self-center overflow-hidden rounded-[var(--radius-lg)] border border-line-strong shadow-[var(--shadow)] sm:h-96 sm:w-80 sm:self-start"
    >
      <motion.div style={{ y: drift }} className="absolute inset-[-6%]">
        <Image
          src="/nicolas-mastromarino-crm-automation-consultant.jpg"
          alt={alt}
          fill
          sizes="(min-width: 640px) 340px, 240px"
          className="scale-125 object-cover"
          style={{ objectPosition: "50% 18%" }}
          priority
        />
      </motion.div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg/40 via-transparent to-transparent"
      />
    </motion.div>
  );
}
