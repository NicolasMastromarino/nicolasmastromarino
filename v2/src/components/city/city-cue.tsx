"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cityBus } from "./city-bus";

/** While this block is in the middle of the viewport the camera frames `cue`. */
export function CityCue({
  cue,
  children,
  className,
  id,
}: {
  cue: string;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? cityBus.set(cue) : cityBus.clear(cue)),
      { rootMargin: "-42% 0px -42% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cityBus.clear(cue);
    };
  }, [cue]);
  return (
    <div ref={ref} id={id} className={className}>
      {children}
    </div>
  );
}
