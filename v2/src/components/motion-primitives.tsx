"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";

export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const VIEWPORT = { once: true, margin: "0px 0px -12% 0px" } as const;

/** Fade + rise + de-blur when scrolled into view. Never scales from 0. */
export function Reveal({
  children,
  delay = 0,
  y = 22,
  className,
  as = "div",
  immediate = false,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "p" | "span" | "article";
  /** Above-the-fold: play on first paint with CSS instead of waiting for hydration. */
  immediate?: boolean;
}) {
  if (immediate) {
    const Plain = as;
    return (
      <Plain
        className={`fade-rise ${className ?? ""}`}
        style={{ animationDelay: `${delay}s` }}
      >
        {children}
      </Plain>
    );
  }
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={VIEWPORT}
      transition={{ duration: 0.7, delay, ease: EASE_OUT }}
    >
      {children}
    </Comp>
  );
}

/** Headline that rises word by word out of a mask (30-60ms stagger). */
export function RevealWords({
  text,
  className,
  delay = 0,
  as = "h1",
  accentFrom,
  immediate = false,
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p";
  /** Index of the first word that gets the accent colour. */
  accentFrom?: number;
  /** Above-the-fold: play on first paint with CSS instead of waiting for hydration. */
  immediate?: boolean;
}) {
  const words = text.split(" ");
  if (immediate) {
    const Plain = as;
    return (
      <Plain className={className} aria-label={text}>
        {words.map((word, i) => (
          <span
            key={`${word}-${i}`}
            aria-hidden="true"
            className="inline-block overflow-hidden pb-[0.12em] align-bottom"
          >
            <span
              className={`word-rise inline-block ${
                accentFrom !== undefined && i >= accentFrom ? "text-accent" : ""
              }`}
              style={{ animationDelay: `${delay + i * 0.045}s` }}
            >
              {word}
            </span>
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </Plain>
    );
  }
  const Tag = motion[as] as typeof motion.h1;
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ staggerChildren: 0.045, delayChildren: delay }}
      aria-label={text}
    >
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          aria-hidden="true"
          className="inline-block overflow-hidden pb-[0.12em] align-bottom"
        >
          <motion.span
            className={`inline-block will-change-transform ${
              accentFrom !== undefined && i >= accentFrom ? "text-accent" : ""
            }`}
            variants={{
              hidden: { y: "110%", opacity: 0 },
              show: { y: "0%", opacity: 1 },
            }}
            transition={{ duration: 0.75, ease: EASE_OUT }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}

/** Container that staggers its StaggerItem children in view. */
export function Stagger({
  children,
  className,
  gap = 0.07,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
      transition={{ staggerChildren: gap, delayChildren: delay }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & Omit<HTMLMotionProps<"div">, "children">) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 26, filter: "blur(5px)" },
        show: { opacity: 1, y: 0, filter: "blur(0px)" },
      }}
      transition={{ duration: 0.65, ease: EASE_OUT }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
