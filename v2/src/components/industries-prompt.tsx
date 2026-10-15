"use client";

import { useTranslations } from "next-intl";
import { cityBus } from "@/components/city/city-bus";
import { INDUSTRIES } from "@/components/city/industries";

/**
 * The hero's way into the industry cards: it names the trades and opens the city's chooser.
 * The four dots are the accent colours of the four buildings, so the pill and the map speak the same language.
 */
export function IndustriesPrompt() {
  const t = useTranslations("home");
  return (
    <button
      type="button"
      onClick={() => cityBus.openIndustries?.()}
      className="press group inline-flex max-w-full items-center gap-3 rounded-full border border-line-strong bg-white/[0.04] py-2 pl-3.5 pr-4 text-left transition-colors hover:bg-white/[0.09]"
    >
      <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
        {INDUSTRIES.map((i) => (
          <span key={i.id} className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
        ))}
      </span>
      <span className="min-w-0 text-[0.95rem] leading-snug">
        <span className="font-semibold text-ink">{t("industriesCta")}</span>
        <span className="hidden text-ink-soft sm:inline lg:hidden">{` · ${t("industriesTrades")}`}</span>
      </span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0 text-accent-text transition-transform duration-300 ease-out-strong group-hover:translate-x-1"
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  );
}
