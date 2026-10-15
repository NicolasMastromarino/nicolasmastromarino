"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { INDUSTRIES, industryById, type IconName, type IndustryId } from "./industries";

type Locale = "en" | "es";

const UI = {
  en: {
    eyebrow: "Industry",
    familiar: "Sound familiar?",
    builds: "What I build",
    flow: "How one job flows",
    tools: "Connected tools",
    outcome: "What it adds up to",
    book: "Book a call",
    contact: "Get in touch",
    next: "Next industry",
    close: "Close",
    switcher: "Choose an industry",
    full: "Open full page",
    chooserTitle: "Which one is yours?",
    chooserSub: "Pick your trade and I will show you what I build for it.",
    other: "Not on the list? Tell me what you run.",
  },
  es: {
    eyebrow: "Industria",
    familiar: "¿Te suena?",
    builds: "Lo que armo",
    flow: "Cómo fluye un trabajo",
    tools: "Herramientas conectadas",
    outcome: "En resumen",
    book: "Agendar una llamada",
    contact: "Escribime",
    next: "Siguiente industria",
    close: "Cerrar",
    switcher: "Elegí una industria",
    full: "Abrir página completa",
    chooserTitle: "¿Cuál es tu rubro?",
    chooserSub: "Elegí tu rubro y te muestro lo que armo para él.",
    other: "¿No está tu rubro? Contame qué hacés.",
  },
} as const;

function Icon({ name }: { name: IconName }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...p}>
      {name === "phone" && <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />}
      {name === "route" && (
        <>
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="6" r="2" />
          <path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6" />
        </>
      )}
      {name === "calendar" && (
        <>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </>
      )}
      {name === "star" && <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8Z" />}
      {name === "refresh" && (
        <>
          <path d="M20 11a8 8 0 0 0-14.5-3.5M4 4v4h4" />
          <path d="M4 13a8 8 0 0 0 14.5 3.5M20 20v-4h-4" />
        </>
      )}
      {name === "receipt" && (
        <>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
          <path d="M9 8h6M9 12h6" />
        </>
      )}
      {name === "bell" && <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15ZM10 20a2 2 0 0 0 4 0" />}
      {name === "layers" && <path d="m12 3 9 5-9 5-9-5ZM3 12.5l9 5 9-5M3 16.5l9 5 9-5" />}
      {name === "bolt" && <path d="M13 3 5 13h6l-1 8 8-10h-6Z" />}
      {name === "drop" && <path d="M12 3c3.5 4.5 6 7.5 6 10.5a6 6 0 0 1-12 0C6 10.5 8.5 7.5 12 3Z" />}
    </svg>
  );
}

export function useIsDesktop() {
  const [d, setD] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setD(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return d;
}

/**
 * The information card of an industry building: it opens over the map (a side card on a desktop, a bottom
 * sheet on a phone), keeps the city visible behind it, and reads in about twenty seconds.
 */
export function IndustryPanel({
  industryId,
  locale,
  onClose,
  onSelect,
}: {
  industryId: IndustryId | null;
  locale: Locale;
  onClose: () => void;
  onSelect: (id: IndustryId) => void;
}) {
  const ui = UI[locale] ?? UI.en;
  const reduce = useReducedMotion();
  const desktop = useIsDesktop();
  const drag = useDragControls();
  const scroller = useRef<HTMLDivElement>(null);
  const chips = useRef<HTMLElement>(null);
  const ind = industryId ? industryById(industryId) : undefined;
  const copy = ind ? ind[locale] ?? ind.en : undefined;

  // a new industry starts at the top of the card
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    chips.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [industryId, reduce]);

  const index = ind ? INDUSTRIES.findIndex((i) => i.id === ind.id) : -1;
  const next = index >= 0 ? INDUSTRIES[(index + 1) % INDUSTRIES.length] : undefined;

  return (
    <AnimatePresence>
      {ind && copy && (
        <motion.aside
          key="industry-panel"
          role="dialog"
          aria-label={copy.name}
          initial={reduce ? { opacity: 0 } : desktop ? { opacity: 0, x: 28 } : { opacity: 0, y: 60 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={reduce ? { opacity: 0 } : desktop ? { opacity: 0, x: 28 } : { opacity: 0, y: 60 }}
          transition={{ duration: 0.34, ease: [0.23, 1, 0.32, 1] }}
          drag={desktop ? false : "y"}
          dragControls={drag}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 90 || info.velocity.y > 500) onClose();
          }}
          className="glass fixed inset-x-0 bottom-0 z-[70] flex max-h-[66vh] flex-col rounded-t-[26px] lg:inset-x-auto lg:bottom-5 lg:right-5 lg:top-[88px] lg:max-h-none lg:w-[min(440px,38vw)] lg:rounded-[26px]"
          style={{ ["--ind" as string]: ind.color }}
        >
          {/* grab handle on phones, so the sheet can be pulled down */}
          <div
            className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 lg:hidden"
            onPointerDown={(e) => drag.start(e)}
            aria-hidden="true"
          >
            <span className="h-1 w-10 rounded-full bg-line-strong" />
          </div>

          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-2 lg:px-6 lg:pt-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="eyebrow" style={{ color: ind.color }}>
                  {ui.eyebrow}
                </span>
                <h2 className="mt-2 font-display text-[1.7rem] font-extrabold leading-[1.05] text-ink">{copy.name}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={ui.close}
                title={ui.close}
                className="press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink hover:bg-white/10"
                autoFocus
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <p className="mt-3 text-[1rem] leading-snug text-ink-soft">{copy.tagline}</p>

            <nav ref={chips} aria-label={ui.switcher} className="chip-row -mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1 pr-8">
              {INDUSTRIES.map((i) => {
                const active = i.id === ind.id;
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => onSelect(i.id)}
                    aria-pressed={active}
                    className={`press shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${active ? "text-bg" : "border-line-strong text-ink-soft hover:text-ink"}`}
                    style={active ? { background: i.color, borderColor: i.color } : undefined}
                  >
                    {(i[locale] ?? i.en).name.split(" (")[0]}
                  </button>
                );
              })}
            </nav>

            <section className="mt-6">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">{ui.familiar}</h3>
              <ul className="mt-3 grid gap-2">
                {copy.pains.map((p) => (
                  <li key={p} className="flex gap-3 rounded-xl border border-line bg-white/[0.03] px-3.5 py-3 text-[0.92rem] leading-snug text-ink-soft">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ind.color }} aria-hidden="true" />
                    {p}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-7">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">{ui.builds}</h3>
              <ol className="mt-3 grid gap-2.5">
                {copy.builds.map((b, i) => (
                  <li key={b.title} className="flex gap-3.5 rounded-xl border border-line bg-white/[0.04] p-3.5">
                    <span
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `color-mix(in srgb, ${ind.color} 18%, transparent)`, color: ind.color }}
                    >
                      <Icon name={b.icon} />
                    </span>
                    <div>
                      <p className="font-display text-[0.98rem] font-bold leading-snug text-ink">
                        <span className="mr-1.5 font-mono text-[11px] text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                        {b.title}
                      </p>
                      <p className="mt-1 text-[0.88rem] leading-snug text-ink-soft">{b.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="mt-7">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">{ui.flow}</h3>
              <ol className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2">
                {copy.flow.map((step, i) => (
                  <li key={step} className="flex items-center gap-1.5">
                    <span className="rounded-full border px-3 py-1 text-[12.5px] font-semibold text-ink" style={{ borderColor: `color-mix(in srgb, ${ind.color} 55%, transparent)` }}>
                      {step}
                    </span>
                    {i < copy.flow.length - 1 && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-faint" aria-hidden="true">
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    )}
                  </li>
                ))}
              </ol>
            </section>

            <section className="mt-7">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">{ui.tools}</h3>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {copy.tools.map((t) => (
                  <li key={t} className="rounded-md bg-white/[0.06] px-2.5 py-1 font-mono text-[11.5px] text-ink-soft">
                    {t}
                  </li>
                ))}
              </ul>
            </section>

            <section
              className="mt-7 rounded-xl border px-4 py-3.5"
              style={{ borderColor: `color-mix(in srgb, ${ind.color} 38%, transparent)`, background: `color-mix(in srgb, ${ind.color} 9%, transparent)` }}
            >
              <h3 className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: ind.color }}>{ui.outcome}</h3>
              <p className="mt-1.5 text-[0.97rem] leading-snug text-ink">{copy.outcome}</p>
            </section>
          </div>

          <div className="flex shrink-0 items-center gap-2 border-t border-line px-5 py-3.5 lg:px-6">
            <Link
              href={{ pathname: "/contact", query: { industry: ind.id } }}
              className="press inline-flex flex-1 items-center justify-center rounded-full bg-accent px-5 py-3 text-[14px] font-semibold text-accent-ink no-underline hover:bg-accent-hover"
            >
              {process.env.NEXT_PUBLIC_BOOKING_URL ? ui.book : ui.contact}
            </Link>
            {next && (
              <button
                type="button"
                onClick={() => onSelect(next.id)}
                className="press inline-flex items-center justify-center gap-1.5 rounded-full border border-line-strong px-4 py-3 text-[13px] font-semibold text-ink hover:bg-white/10"
              >
                {ui.next}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/** a small drawn mark for each trade, in the same stroke as the rest of the card */
function TradeIcon({ id }: { id: IndustryId }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" {...p}>
      {id === "hvac" && <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6.5l2.5-2M9.5 19.5 12 17.5l2.5 2" />}
      {id === "roofing" && <path d="M3 12 12 4l9 8M6 10.5V20h12v-9.5M10 20v-5h4v5" />}
      {id === "plumbing" && <path d="M12 3c3.5 4.5 6 7.5 6 10.5a6 6 0 0 1-12 0C6 10.5 8.5 7.5 12 3ZM12 17v-4l-2 2" />}
      {id === "outdoor" && <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19c2-4 5-7 9-9" />}
    </svg>
  );
}

/**
 * The door to the industry cards: four trades to choose from before any card opens. While a row is pointed at or
 * focused the camera shows that building, so the choice is made looking at the place it leads to.
 */
export function IndustryChooser({
  open,
  locale,
  onClose,
  onSelect,
  onPreview,
}: {
  open: boolean;
  locale: Locale;
  onClose: () => void;
  onSelect: (id: IndustryId) => void;
  onPreview: (id: IndustryId | null) => void;
}) {
  const ui = UI[locale] ?? UI.en;
  const reduce = useReducedMotion();
  const desktop = useIsDesktop();
  const drag = useDragControls();

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="industry-chooser"
          role="dialog"
          aria-label={ui.chooserTitle}
          initial={reduce ? { opacity: 0 } : desktop ? { opacity: 0, x: 28 } : { opacity: 0, y: 60 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={reduce ? { opacity: 0 } : desktop ? { opacity: 0, x: 28 } : { opacity: 0, y: 60 }}
          transition={{ duration: 0.34, ease: [0.23, 1, 0.32, 1] }}
          drag={desktop ? false : "y"}
          dragControls={drag}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 90 || info.velocity.y > 500) onClose();
          }}
          onMouseLeave={() => onPreview(null)}
          className="glass fixed inset-x-0 bottom-0 z-[70] flex max-h-[80vh] flex-col rounded-t-[26px] lg:inset-x-auto lg:bottom-auto lg:right-5 lg:top-[88px] lg:max-h-[calc(100vh-108px)] lg:w-[min(440px,38vw)] lg:rounded-[26px]"
        >
          <div
            className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 lg:hidden"
            onPointerDown={(e) => drag.start(e)}
            aria-hidden="true"
          >
            <span className="h-1 w-10 rounded-full bg-line-strong" />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-2 lg:px-6 lg:pt-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-[1.7rem] font-extrabold leading-[1.05] text-ink">{ui.chooserTitle}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={ui.close}
                title={ui.close}
                className="press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink hover:bg-white/10"
                autoFocus
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <p className="mt-3 text-[1rem] leading-snug text-ink-soft">{ui.chooserSub}</p>

            <ul className="mt-5 grid gap-2.5">
              {INDUSTRIES.map((i) => {
                const c = i[locale] ?? i.en;
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(i.id)}
                      onMouseEnter={() => onPreview(i.id)}
                      onFocus={() => onPreview(i.id)}
                      className="press group flex w-full items-center gap-3.5 rounded-2xl border border-line bg-white/[0.04] p-3.5 text-left transition-colors hover:bg-white/[0.09] focus-visible:bg-white/[0.09]"
                    >
                      <span
                        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: `color-mix(in srgb, ${i.color} 20%, transparent)`, color: i.color }}
                      >
                        <TradeIcon id={i.id} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-[1.05rem] font-bold leading-tight text-ink">{c.name.split(" (")[0]}</span>
                        <span className="mt-0.5 block text-[0.88rem] leading-snug text-ink-soft">{c.who}</span>
                      </span>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="shrink-0 text-ink-faint transition-transform duration-200 ease-out-strong group-hover:translate-x-1 group-hover:text-ink"
                      >
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>

            <Link href="/contact" className="mt-5 inline-block text-[0.92rem] text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink">
              {ui.other}
            </Link>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
