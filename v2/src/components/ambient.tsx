"use client";

import { motion, useScroll, useSpring } from "motion/react";
import { CityCanvas } from "@/components/city/city-canvas";

/** The 3D city behind everything, plus film grain and a scroll progress line. */
export function Ambient() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  return (
    <>
      <CityCanvas />
      <div aria-hidden="true" className="grain" />
      <motion.div
        aria-hidden="true"
        style={{ scaleX: progress }}
        className="fixed inset-x-0 top-0 z-[70] h-[2px] origin-left bg-gradient-to-r from-accent via-accent-2 to-accent-3"
      />
    </>
  );
}
