"use client";

import { useEffect } from "react";

const GA_ID = "G-GM5KEPCE27";

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

/**
 * Google Analytics, loaded only once the visitor does something (touch, scroll, key, click) or after a long idle.
 * It used to load with the page: 176 KB of script that blocked the main thread while the text was still appearing.
 */
export function Analytics() {
  useEffect(() => {
    let started = false;
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    const start = () => {
      if (started) return;
      started = true;
      events.forEach((e) => window.removeEventListener(e, start));
      window.clearTimeout(timer);
      const w = window as GtagWindow;
      w.dataLayer = w.dataLayer || [];
      w.gtag = function gtag() {
        // gtag.js reads the arguments object itself, an array would not do
        // eslint-disable-next-line prefer-rest-params
        w.dataLayer!.push(arguments);
      };
      w.gtag("js", new Date());
      w.gtag("config", GA_ID);
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
      document.head.appendChild(s);
    };
    events.forEach((e) => window.addEventListener(e, start, { passive: true, once: true }));
    const timer = window.setTimeout(start, 9000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, start));
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}
