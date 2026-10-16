"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { CityEngine, CityLabels, CityRoute, HoverInfo } from "./city-engine";
import { INDUSTRIES, type IndustryId } from "./industries";
import { IndustryChooser, IndustryPanel } from "./industry-panel";
import { cityBus } from "./city-bus";

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
    exploreShort: "Explore",
    exit: "Back to the site",
    exitShort: "Exit",
    rainOn: "Turn the rain off",
    rainOff: "Turn the rain on",
    toDay: "Switch to day",
    toNight: "Switch to night",
    controls: "Drag to move · Scroll or pinch to zoom · Q / E to rotate · Click a building to enter · Esc to exit",
    controlsTouch: "Drag to move · Pinch to zoom · Tap a building to enter",
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
    exploreShort: "Explorar",
    exit: "Volver al sitio",
    exitShort: "Salir",
    rainOn: "Apagar la lluvia",
    rainOff: "Prender la lluvia",
    toDay: "Pasar a día",
    toNight: "Pasar a noche",
    controls: "Arrastrá para moverte · Rueda o pellizco para zoom · Q / E para rotar · Click en un edificio para entrar · Esc para salir",
    controlsTouch: "Arrastrá para moverte · Pellizcá para hacer zoom · Tocá un edificio para entrar",
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
  const [touch, setTouch] = useState(false);
  // the input type only exists in the browser, so it cannot be the initial state
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), []);
  const [chooser, setChooser] = useState(false);
  const chooserRef = useRef(false);
  const previewTimer = useRef<number | undefined>(undefined);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const pushedRef = useRef(false); // the card added a history entry, so Back can close it
  const skipPop = useRef(false);

  const setIndustryUrl = (id: IndustryId | null) => {
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("industry", id);
    else u.searchParams.delete("industry");
    window.history.replaceState(window.history.state, "", u);
  };
  const pushCardEntry = () => {
    if (pushedRef.current) return;
    pushedRef.current = true;
    window.history.pushState({ ...(window.history.state ?? {}), cityCard: 1 }, "", window.location.href);
  };
  const openIndustry = (id: IndustryId, opts?: { push?: boolean }) => {
    if (opts?.push !== false) pushCardEntry();
    window.clearTimeout(previewTimer.current);
    chooserRef.current = false;
    setChooser(false);
    industryRef.current = id;
    setIndustry(id);
    setShowHint(false);
    engineRef.current?.setFocus("ind-" + id);
    document.documentElement.dataset.industry = "1";
    setIndustryUrl(id);
  };
  const closePanels = (fromPop: boolean) => {
    window.clearTimeout(previewTimer.current);
    if (!industryRef.current && !chooserRef.current) return;
    industryRef.current = null;
    chooserRef.current = false;
    setIndustry(null);
    setChooser(false);
    const back = lastTrigger.current;
    lastTrigger.current = null;
    if (back) window.requestAnimationFrame(() => back.isConnected && back.focus({ preventScroll: true }));
    engineRef.current?.setFocus(null);
    delete document.documentElement.dataset.industry;
    if (fromPop) {
      pushedRef.current = false;
    } else if (pushedRef.current) {
      pushedRef.current = false;
      skipPop.current = true;
      window.history.back();
    } else {
      setIndustryUrl(null);
    }
  };
  const closeIndustry = () => closePanels(false);
  const closePanelsRef = useRef(closePanels);
  const openIndustryRef = useRef(openIndustry);

  // the chooser: four trades before any card opens
  const openChooser = () => {
    if (!industryRef.current && !chooserRef.current && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      lastTrigger.current = document.activeElement;
    }
    pushCardEntry();
    chooserRef.current = true;
    setChooser(true);
    setShowHint(false);
    document.documentElement.dataset.industry = "1";
  };
  const openChooserRef = useRef(openChooser);
  // the refs always hold the latest versions, for the engine and the hero, which outlive a render
  useEffect(() => {
    openIndustryRef.current = openIndustry;
    openChooserRef.current = openChooser;
    closePanelsRef.current = closePanels;
  });

  // the Back button closes an open card rather than leaving the page
  useEffect(() => {
    const onPop = () => {
      if (skipPop.current) {
        skipPop.current = false;
        return;
      }
      if (industryRef.current || chooserRef.current) closePanelsRef.current(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // pointing at a trade shows its building; leaving the list lets the camera come back
  const previewIndustry = (id: IndustryId | null) => {
    window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(
      () => {
        if (industryRef.current || !chooserRef.current) return;
        engineRef.current?.setFocus(id ? "ind-" + id : null);
      },
      id ? 200 : 350,
    );
  };

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
    if (q && INDUSTRIES.some((i) => i.id === q) && routeRef.current === "home") openIndustryRef.current(q as IndustryId, { push: false });
  }, [ready]);

  // while a card is open the faded page behind it cannot take focus
  useEffect(() => {
    const on = Boolean(industry) || chooser;
    const parts = [document.querySelector("main"), document.querySelector("footer")];
    parts.forEach((el) => el?.toggleAttribute("inert", on));
    return () => parts.forEach((el) => el?.removeAttribute("inert"));
  }, [industry, chooser]);

  // page content (the hero) can ask the city for the chooser
  useEffect(() => {
    cityBus.openIndustries = () => openChooserRef.current();
    return () => {
      cityBus.openIndustries = null;
    };
  }, []);

  useEffect(() => {
    if (!industry && !chooser) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeIndustry();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industry, chooser]);

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
    if (industryRef.current || chooserRef.current) {
      window.clearTimeout(previewTimer.current);
      pushedRef.current = false;
      industryRef.current = null;
      chooserRef.current = false;
      setIndustry(null);
      setChooser(false);
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
        // the scene is built in slices so the page stays responsive; the text is already on screen meanwhile
        try {
          await engine.build();
        } catch (e) {
          engine.dispose();
          throw e;
        }
        if (disposed) {
          engine.dispose();
          return;
        }
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
        setReady(true);
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
        className={`fixed inset-0 -z-10 block h-full w-full transition-opacity duration-[1400ms] ease-out ${failed ? "hidden" : ready ? "opacity-100" : "opacity-0"}`}
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
          animate={{ opacity: industry || chooser ? 0 : 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.23, 1, 0.32, 1], opacity: { duration: 0.2, delay: industry || chooser ? 0 : 0.4 } }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[66] sm:inset-x-auto sm:bottom-5 sm:right-5"
        >
          <div aria-hidden="true" className="dock-scrim absolute inset-0 sm:hidden" />
          <div
            className={`relative flex items-center justify-between gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:justify-start sm:p-0 ${industry || chooser ? "pointer-events-none" : "pointer-events-auto"}`}
          >
          <button
            type="button"
            onClick={openChooser}
            aria-label={copy.industriesBtn}
            title={copy.industriesBtn}
            className="press inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface/90 px-3.5 text-[13.5px] font-semibold text-ink backdrop-blur-md hover:bg-surface"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent-text">
              <path d="M4 21V9l6-3v15M10 21V4l10 4v13M2.5 21h19M7 12h0M7 16h0M14 12h2M14 16h2" />
            </svg>
            <span>{copy.industriesBtn}</span>
          </button>
          <div className="flex items-center sm:gap-2 max-sm:rounded-full max-sm:border max-sm:border-line-strong max-sm:bg-surface/90 max-sm:backdrop-blur-md">
          <button
            type="button"
            onClick={toggleRain}
            aria-pressed={rain}
            aria-label={rain ? copy.rainOn : copy.rainOff}
            title={rain ? copy.rainOn : copy.rainOff}
            className="press inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-surface/90 text-ink backdrop-blur-md hover:bg-surface max-sm:border-0 max-sm:bg-transparent max-sm:backdrop-blur-none"
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
            className="press inline-flex h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-surface/90 text-ink backdrop-blur-md hover:bg-surface max-sm:border-0 max-sm:bg-transparent max-sm:backdrop-blur-none"
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
          </div>
          <button
            type="button"
            onClick={() => setExplore(!exploring)}
            className="press inline-flex items-center gap-2.5 rounded-full border border-line-strong bg-surface/90 px-5 py-3 text-[13.5px] font-semibold text-ink backdrop-blur-md hover:bg-surface"
          >
            <span aria-hidden="true" className="text-accent-text">{exploring ? "✕" : "⌖"}</span>
            <span className="sm:hidden">{exploring ? copy.exitShort : copy.exploreShort}</span>
            <span className="hidden sm:inline">{exploring ? copy.exit : copy.explore}</span>
          </button>
          </div>
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
            className="pointer-events-none fixed left-1/2 top-20 z-[66] max-w-[92vw] -translate-x-1/2 rounded-full border border-line-strong bg-surface/85 px-5 py-2.5 text-center font-mono text-[11.5px] tracking-wide text-ink-soft backdrop-blur-md max-sm:bottom-[5.75rem] max-sm:top-auto max-sm:rounded-2xl"
          >
            {touch ? copy.controlsTouch : copy.controls}
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

      <IndustryChooser open={chooser} locale={locale} onClose={closeIndustry} onSelect={openIndustry} onPreview={previewIndustry} />
      <IndustryPanel industryId={industry} locale={locale} onClose={closeIndustry} onSelect={openIndustry} />

    </>
  );
}
