"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** reducedMotion="user": transforms and layout animations switch off, opacity stays. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
