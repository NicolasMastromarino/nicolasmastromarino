"use client";

import { useEffect, useRef, useState } from "react";

const TOOLS = [
  "GoHighLevel",
  "Zapier",
  "Kickserv",
  "Airtable",
  "Stripe",
  "Google Sheets",
  "Klaviyo",
  "Google Analytics",
  "Google Tag Manager",
  "Search Console",
  "SEMrush",
  "WordPress",
  "Paperform",
  "Twilio",
];

const PIXELS_PER_SECOND = 40;

function Row({ reverse = false, tools }: { reverse?: boolean; tools: string[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [anim, setAnim] = useState<{ distance: number; duration: number } | null>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // The track renders two back-to-back copies so the loop can reset invisibly
    // at the halfway point. That only works if the scroll distance matches the
    // ACTUAL rendered width of one copy (it shifts after font swap / resize),
    // so measure it instead of assuming -50%.
    function measure() {
      const setWidth = el!.scrollWidth / 2;
      if (setWidth > 0) {
        setAnim({ distance: setWidth, duration: setWidth / PIXELS_PER_SECOND });
      }
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const items = [...tools, ...tools];

  return (
    <div
      ref={trackRef}
      className="flex w-max gap-3"
      style={
        anim
          ? ({
              animation: `${reverse ? "tools-scroll-reverse" : "tools-scroll"} ${anim.duration}s linear infinite`,
              "--marquee-distance": `-${anim.distance}px`,
            } as React.CSSProperties)
          : undefined
      }
    >
      {items.map((tool, i) => (
        <span
          key={`${tool}-${i}`}
          className="flex-none whitespace-nowrap rounded-full border border-line bg-surface/80 px-4 py-2 font-mono text-[13px] text-ink-soft transition-colors duration-200 hover:border-accent/60 hover:text-ink"
        >
          {tool}
        </span>
      ))}
    </div>
  );
}

export function ToolsMarquee() {
  const half = Math.ceil(TOOLS.length / 2);
  return (
    <div
      className="flex flex-col gap-3 overflow-hidden border-y border-line bg-bg/55 py-6 backdrop-blur-md"
      style={{
        maskImage: "linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)",
      }}
    >
      <Row tools={TOOLS} />
      <Row tools={[...TOOLS.slice(half), ...TOOLS.slice(0, half)]} reverse />
    </div>
  );
}
