"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { CityEngine, CityLabels, CityRoute, HoverInfo } from "./city-engine";
import { INDUSTRIES, type IndustryId } from "./industries";
import { IndustryPanel } from "./industry-panel";

const COPY = {
  en: {
    hub: "ONE SYSTEM",
    tools: ["GoHighLevel", "Kickserv", "Airtable", "Stripe", "Sheets", "Zapier"],
    cases: ["DISPATCH", "SUPPORT TICKETS", "REVENUE REPORTS", "AGENCY AUTOMATION", "BOOKKEEPLY", "JBZ BEATS"],
    crm: "CRM",
    automation: "AUTOMATION",
    contact: "SAY HELLO",
    hint: "Hover the buildings. Click to enter.",
    routes: { services: "Enter services", caseStudies: "See the case studies", contact: "Get in touch" },
    industries: ["HVAC", "ROOFERS", "PLUMBING & ELECTRIC", "LANDSCAPING & CLEANING"],
    industryHint: "See what I build for {name}",
    industriesBtn: "Industries",
    loading: "Booting the city",
    explore: "Explore the city",
    exit: "Back to the site",
    rainOn: "Turn the rain off",
    rainOff: "Turn the rain on",
    toDay: "Switch to day",
    toNight: "Switch to night",
    controls: "Drag to move · Scroll or pinch to zoom · Q / E to rotate · Click a building to enter · Esc to exit",
  },
  es: {
    hub: "UN SISTEMA",
    tools: ["GoHighLevel", "Kickserv", "Airtable", "Stripe", "Sheets", "Zapier"],
    cases: ["DESPACHO", "TICKETS DE SOPORTE", "REPORTES DE INGRESOS", "AUTOMATIZACIÓN DE AGENCIA", "BOOKKEEPLY", "JBZ BEATS"],
    crm: "CRM",
    automation: "AUTOMATIZACIÓN",
    contact: "ESCRIBIME",
    hint: "Pasá el mouse por los edificios. Click para entrar.",
    routes: { services: "Ver servicios", caseStudies: "Ver casos de éxito", contact: "Escribime" },
    industries: ["HVAC", "TECHISTAS", "PLOMERÍA Y ELECTRICIDAD", "PAISAJISMO Y LIMPIEZA"],
    industryHint: "Mirá lo que armo para {name}",
    industriesBtn: "Industrias",
    loading: "Encendiendo la ciudad",
    explore: "Explorar la ciudad",
    exit: "Volver al sitio",
    rainOn: "Apagar la lluvia",
    rainOff: "Prender la lluvia",
    toDay: "Pasar a día",
    toNight: "Pasar a noche",
    controls: "Arrastrá para moverte · Rueda o pellizco para zoom · Q / E para rotar · Click en un edificio para entrar · Esc para salir",
  },
} as const;

function routeFor(pathname: string): CityRoute {
  if (pathname.startsWith("/services")) return "services";
  if (pathname.startsWith("/case-studies")) return "case-studies";
  if (pathname.startsWith("/about")) return "about";
  if (pathname.startsWith("/blog")) return "blog";
  if (pathname.startsWith("/contact")) return "contact";
  return "home";
}

export function CityCanvas() {
  const locale = useLocale() as "en" | "es";
  const copy = COPY[locale] ?? COPY.en;
  const pathname = usePathname();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CityEngine | null>(null);
  const routeRef = useRef<CityRoute>(routeFor(pathname));
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<{ info: HoverInfo; x: number; y: number } | null>(null);
  const [showHint, setShowHint] = useState(false);
  const hintSeen = useRef(false);
  const [exploring, setExploring] = useState(false);
  const exploringRef = useRef(false);
  const [rain, setRain] = useState(false);
  const [day, setDay] = useState(false);
  const [ring, setRing] = useState(false);
  const ringSeen = useRef(false);
  const weatherRef = useRef({ rain: false, day: false });
  const [industry, setIndustry] = useState<IndustryId | null>(null);
  const industryRef = useRef<IndustryId | null>(null);

  const setIndustryUrl = (id: IndustryId | null) => {
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("industry", id);
    else u.searchParams.delete("industry");
    window.history.replaceState(window.history.state, "", u);
  };
  const openIndustry = (id: IndustryId) => {
    industryRef.current = id;
    setIndustry(id);
    setShowHint(false);
    engineRef.current?.setFocus("ind-" + id);
    document.documentElement.dataset.industry = "1";
    setIndustryUrl(id);
  };
  const closeIndustry = () => {
    if (!industryRef.current) return;
    industryRef.current = null;
    setIndustry(null);
    engineRef.current?.setFocus(null);
    delete document.documentElement.dataset.industry;
    setIndustryUrl(null);
  };
  const openIndustryRef = useRef(openIndustry);
  openIndustryRef.current = openIndustry;

  const toggleRain = () => {
    const v = !rain;
    setRain(v);
    weatherRef.current.rain = v;
    engineRef.current?.setRain(v);
  };
  const toggleDay = () => {
    const v = !day;
    setDay(v);
    setRing(false);
    ringSeen.current = true;
    weatherRef.current.day = v;
    engineRef.current?.setDay(v);
    if (v) document.documentElement.dataset.day = "1";
    else delete document.documentElement.dataset.day;
  };

  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams(window.location.search).get("industry");
    if (q && INDUSTRIES.some((i) => i.id === q) && routeRef.current === "home") openIndustryRef.current(q as IndustryId);
  }, [ready]);

  useEffect(() => {
    if (!industry) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeIndustry();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industry]);

  // a ring pulses around the day/night switch once the evening has fallen, until it is used
  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => !ringSeen.current && setRing(true), 5200);
    return () => window.clearTimeout(id);
  }, [ready]);

  const setExplore = (on: boolean) => {
    exploringRef.current = on;
    setExploring(on);
    engineRef.current?.setExplore(on);
    if (on) document.documentElement.dataset.explore = "1";
    else delete document.documentElement.dataset.explore;
  };

  // Keep the engine's route in sync with navigation.
  useEffect(() => {
    const r = routeFor(pathname);
    routeRef.current = r;
    if (industryRef.current) {
      industryRef.current = null;
      setIndustry(null);
      engineRef.current?.setFocus(null);
      delete document.documentElement.dataset.industry;
    }
    document.documentElement.dataset.cityRoute = r;
    engineRef.current?.setRoute(r);
    // navigating anywhere ends free roam
    if (exploringRef.current) {
      exploringRef.current = false;
      setExploring(false);
      engineRef.current?.setExplore(false);
      delete document.documentElement.dataset.explore;
    }
  }, [pathname]);

  useEffect(() => {
    let disposed = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.innerWidth < 768 || window.matchMedia("(pointer: coarse)").matches;

    (async () => {
      try {
        const [{ CityEngine }] = await Promise.all([import("./city-engine"), document.fonts.ready]);
        if (disposed) return;
        const family =
          getComputedStyle(document.documentElement).getPropertyValue("--font-plex-mono").trim() || "monospace";
        const labels: CityLabels = {
          hub: copy.hub,
          tools: [...copy.tools],
          cases: [...copy.cases],
          crm: copy.crm,
          automation: copy.automation,
          contact: copy.contact,
          hint: copy.hint,
          routes: copy.routes,
          industries: [...copy.industries],
          industryHint: copy.industryHint,
        };
        const engine = new CityEngine({
          canvas,
          labels,
          fontFamily: family,
          reduced,
          mobile,
          onHover: (info, x, y) => {
            setHover(info ? { info, x, y } : null);
            if (info) hintSeen.current = true;
          },
          onActivate: (info) => {
            if (info.id.startsWith("ind-")) {
              openIndustryRef.current(info.id.slice(4) as IndustryId);
              return;
            }
            if (info.id.startsWith("case-") && routeRef.current === "case-studies") {
              document.getElementById(info.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
              return;
            }
            router.push(info.href, { transitionTypes: ["nav-forward"] });
          },
        });
        engine.setRoute(routeRef.current);
        engine.setRain(weatherRef.current.rain);
        engine.setDay(weatherRef.current.day);
        engine.onExploreExit = () => {
          exploringRef.current = false;
          setExploring(false);
          engine.setExplore(false);
          delete document.documentElement.dataset.explore;
        };
        engineRef.current = engine;
        if (process.env.NODE_ENV !== "production") (window as unknown as { __city?: CityEngine }).__city = engine;
        engine.start();
        window.setTimeout(() => !disposed && setReady(true), reduced ? 200 : 900);
        window.setTimeout(() => {
          if (!disposed && !hintSeen.current && routeRef.current === "home") setShowHint(true);
        }, 4200);
        window.setTimeout(() => !disposed && setShowHint(false), 12000);
      } catch (err) {
        console.warn("3D city unavailable, using static background", err);
        if (!disposed) {
          setFailed(true);
          setReady(true);
        }
      }
    })();

    return () => {
      disposed = true;
      engineRef.current?.dispose();
      engineRef.current = null;
      document.body.style.cursor = "";
    };
    // The engine is created once; labels never change within a locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`fixed inset-0 -z-10 block h-full w-full ${failed ? "hidden" : ""}`}
      />
      {failed && (
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,91,61,0.25),transparent_55%),radial-gradient(ellipse_at_90%_20%,rgba(131,147,255,0.22),transparent_55%)]"
        />
      )}

      {/* readability veil over the 3D scene */}
      <div aria-hidden="true" className="city-veil pointer-events-none fixed inset-0 -z-10" />

      {ready && !failed && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className={`fixed bottom-5 right-5 z-[66] flex items-center gap-2 transition-opacity duration-200 ${industry ? "pointer-events-none opacity-0" : ""}`}
        >
          <button
            type="button"
            onClick={() => openIndustry(industry ?? INDUSTRIES[0].id)}
            aria-label={copy.industriesBtn}
            title={copy.industriesBtn}
            className="press inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface/90 px-3.5 text-[13.5px] font-semibold text-ink backdrop-blur-md hover:bg-surface"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent-text">
              <path d="M4 21V9l6-3v15M10 21V4l10 4v13M2.5 21h19M7 12h0M7 16h0M14 12h2M14 16h2" />
            </svg>
            <span className="hidden sm:inline">{copy.industriesBtn}</span>
          </button>
          <button
            type="button"
            onClick={toggleRain}
            aria-pressed={rain}
            aria-label={rain ? copy.rainOn : copy.rainOff}
            title={rain ? copy.rainOn : copy.rainOff}
            className="press inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-surface/90 text-ink backdrop-blur-md hover:bg-surface"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={rain ? "text-accent-2" : "opacity-60"}>
              <path d="M7 15a4 4 0 0 1-.4-7.98A5.5 5.5 0 0 1 17.2 8 3.5 3.5 0 0 1 17 15H7Z" />
              {rain ? <path d="M8 18.5l-1 2M12 18.5l-1 2M16 18.5l-1 2" /> : <path d="M4 20 20 4" />}
            </svg>
          </button>
          <span className="relative inline-flex">
            {ring && !day && (
              <>
                <span aria-hidden="true" className="ring-pulse pointer-events-none absolute inset-0 rounded-full border-2 border-accent" />
                <span aria-hidden="true" className="ring-pulse ring-pulse-late pointer-events-none absolute inset-0 rounded-full border-2 border-accent" />
              </>
            )}
          <button
            type="button"
            onClick={toggleDay}
            aria-pressed={day}
            aria-label={day ? copy.toNight : copy.toDay}
            title={day ? copy.toNight : copy.toDay}
            className="press inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-surface/90 text-ink backdrop-blur-md hover:bg-surface"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent-text">
              {day ? (
                <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
              ) : (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </>
              )}
            </svg>
          </button>
          </span>
          <button
            type="button"
            onClick={() => setExplore(!exploring)}
            className="press inline-flex items-center gap-2.5 rounded-full border border-line-strong bg-surface/90 px-5 py-3 text-[13.5px] font-semibold text-ink backdrop-blur-md hover:bg-surface"
          >
            <span aria-hidden="true" className="text-accent-text">{exploring ? "✕" : "⌖"}</span>
            {exploring ? copy.exit : copy.explore}
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {exploring && (
          <motion.p
            key="controls"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="pointer-events-none fixed left-1/2 top-20 z-[66] max-w-[92vw] -translate-x-1/2 rounded-full border border-line-strong bg-surface/85 px-5 py-2.5 text-center font-mono text-[11.5px] tracking-wide text-ink-soft backdrop-blur-md"
          >
            {copy.controls}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hover && (
          <motion.div
            key="tip"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
            style={{ left: hover.x + 18, top: hover.y + 18 }}
            className="pointer-events-none fixed z-[75] max-w-[240px] rounded-2xl border border-line-strong bg-surface/90 px-4 py-3 backdrop-blur-md"
          >
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent-2">{hover.info.label}</p>
            <p className="mt-1 text-[13px] font-semibold text-ink">{hover.info.hint} →</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHint && !hover && (
          <motion.p
            key="hint"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="pointer-events-none fixed bottom-6 left-1/2 z-[60] hidden -translate-x-1/2 rounded-full border border-line-strong bg-surface/80 px-5 py-2.5 font-mono text-[11.5px] tracking-wide text-ink-soft backdrop-blur-md lg:block"
          >
            {copy.hint}
          </motion.p>
        )}
      </AnimatePresence>

      <IndustryPanel industryId={industry} locale={locale} onClose={closeIndustry} onSelect={openIndustry} />

      <AnimatePresence>
        {!ready && (
          <motion.div
            key="loader"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-6 bg-bg"
          >
            <span className="font-display text-[1.6rem] font-extrabold tracking-tight text-ink">
              Nicolás<span className="text-accent">.</span>M
            </span>
            <span className="h-[2px] w-40 overflow-hidden rounded bg-line-strong">
              <span className="block h-full w-full origin-left animate-[loadbar_1.1s_cubic-bezier(0.23,1,0.32,1)_forwards] bg-accent" />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">{copy.loading}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
