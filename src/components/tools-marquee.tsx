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

export function ToolsMarquee() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [anim, setAnim] = useState<{ distance: number; duration: number } | null>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // The track renders two back-to-back copies of TOOLS so the loop can
    // reset invisibly at the halfway point. That only works if the scroll
    // distance matches the ACTUAL rendered width of one copy, which can
    // shift after mount (web font swap, new tools added, viewport change).
    // Measuring it directly instead of assuming -50% keeps the loop seamless.
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

  const items = [...TOOLS, ...TOOLS];

  return (
    <div className="overflow-hidden border-y border-line py-6">
      <div
        ref={trackRef}
        className="flex w-max gap-3.5"
        style={
          anim
            ? ({
                animation: `tools-scroll ${anim.duration}s linear infinite`,
                "--marquee-distance": `-${anim.distance}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {items.map((tool, i) => (
          <span
            key={`${tool}-${i}`}
            className="flex-none whitespace-nowrap rounded-full border border-line bg-surface px-4 py-2 font-mono text-[13px] text-ink-soft"
          >
            {tool}
          </span>
        ))}
      </div>
    </div>
  );
}
