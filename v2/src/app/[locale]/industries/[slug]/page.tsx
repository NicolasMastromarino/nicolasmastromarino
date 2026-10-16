import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { PageShell } from "@/components/page-shell";
import { FinalCta } from "@/components/final-cta";
import { CtaLink } from "@/components/cta-link";
import { NavLink } from "@/components/nav-link";
import { Reveal, RevealWords } from "@/components/motion-primitives";
import { BreadcrumbSchema } from "@/components/json-ld";
import { IndustryExplode } from "@/components/industry-explode";
import { Icon } from "@/components/industry-icon";
import { INDUSTRIES, industryById } from "@/components/city/industries";
import { pageMetadata, SITE_URL } from "@/lib/seo";

type Locale = "en" | "es";

const UI = {
  en: {
    home: "Home",
    eyebrow: "Industry",
    h1: (who: string) => `CRM and automation for ${who.toLowerCase()}`,
    title: (name: string) => `${name}: CRM & automation`,
    cta: "Tell me about your business",
    seeCity: "See it in the city",
    explodeTitle: "How it fits together",
    explodeHint: "Scroll to take it apart",
    familiar: "Sound familiar?",
    builds: "What I build",
    flow: "How one job flows",
    tools: "Connected tools",
    outcome: "What it adds up to",
    others: "Other trades",
    ctaTitle: "Tell me how your jobs flow today.",
    ctaSub: "I will tell you honestly what needs fixing first.",
    ctaButton: "Get in touch",
  },
  es: {
    home: "Inicio",
    eyebrow: "Industria",
    h1: (who: string) => `CRM y automatización para ${who.toLowerCase()}`,
    title: (name: string) => `${name}: CRM y automatización`,
    cta: "Contame de tu negocio",
    seeCity: "Verlo en la ciudad",
    explodeTitle: "Cómo encaja todo",
    explodeHint: "Bajá para desarmarlo",
    familiar: "¿Te suena?",
    builds: "Lo que armo",
    flow: "Cómo fluye un trabajo",
    tools: "Herramientas conectadas",
    outcome: "En resumen",
    others: "Otros rubros",
    ctaTitle: "Contame cómo corren hoy tus trabajos.",
    ctaSub: "Te digo con honestidad qué conviene arreglar primero.",
    ctaButton: "Escribime",
  },
} as const;

/** cuts a description at a word boundary so it is not truncated mid-word in the results */
function clip(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "") + ".";
}

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => INDUSTRIES.map((i) => ({ locale, slug: i.id })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const ind = industryById(slug);
  if (!ind) return {};
  const l = (locale === "es" ? "es" : "en") as Locale;
  const copy = ind[l];
  const ui = UI[l];
  // a title past 60 characters is cut in the results: use the full brand when it fits, a short one when it does not
  const base = ui.title(copy.name);
  const title = [`${base} | Nicolás Mastromarino`, `${base} | N. Mastromarino`, base].find((t) => t.length <= 60) ?? base;
  return pageMetadata({
    locale,
    path: `/industries/${slug}`,
    title,
    description: clip(`${copy.who}. ${copy.tagline}`, 158),
  });
}

export default async function IndustryPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const ind = industryById(slug);
  if (!ind) notFound();
  setRequestLocale(locale);
  const l = (locale === "es" ? "es" : "en") as Locale;
  const copy = ind[l];
  const ui = UI[l];
  const prefix = l === "es" ? "/es" : "";
  const others = INDUSTRIES.filter((i) => i.id !== ind.id);

  const serviceData = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: ui.h1(copy.who),
    serviceType: "CRM implementation and marketing automation",
    description: copy.outcome,
    url: new URL(`${prefix}/industries/${ind.id}`, SITE_URL).toString(),
    provider: { "@type": "Person", name: "Nicolás Mastromarino", url: SITE_URL },
    audience: { "@type": "Audience", audienceType: copy.who },
    areaServed: "Worldwide",
  };

  return (
    <PageShell>
      <BreadcrumbSchema
        locale={locale}
        items={[
          { name: ui.home, path: "/" },
          { name: copy.name, path: "/industries/" + ind.id },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceData) }} />

      <section className="rail px-5 pb-10 pt-12 sm:px-8 sm:pt-14 lg:min-h-[52vh]">
        <Reveal y={10} immediate>
          <span className="eyebrow" style={{ color: ind.color }}>
            {ui.eyebrow} · {copy.name}
          </span>
        </Reveal>
        <RevealWords text={ui.h1(copy.who)} immediate delay={0.1} className="mt-5 max-w-[18ch] text-[2.4rem] leading-[1.02] sm:text-[3.9rem]" />
        <Reveal delay={0.4} immediate>
          <p className="mt-6 max-w-[56ch] text-[1.12rem] leading-relaxed text-ink-soft">{copy.tagline}</p>
        </Reveal>
        <Reveal delay={0.5} immediate className="mt-8 flex flex-wrap items-center gap-3">
          <CtaLink href={`/contact?industry=${ind.id}`}>{ui.cta}</CtaLink>
          <CtaLink href={`/?industry=${ind.id}`} variant="ghost">
            {ui.seeCity}
          </CtaLink>
        </Reveal>
      </section>

      <IndustryExplode
        color={ind.color}
        variant={ind.id === "hvac" ? "hvac" : "stack"}
        title={ui.explodeTitle}
        hint={ui.explodeHint}
        parts={copy.builds.map((b) => ({ icon: b.icon, title: b.title, text: b.text }))}
      />

      <section className="rail px-5 py-16 sm:px-8 sm:py-20">
        <h2 className="eyebrow">{ui.familiar}</h2>
        <ul className="mt-6 grid gap-3">
          {copy.pains.map((p) => (
            <li key={p} className="glass flex gap-3.5 rounded-2xl p-4 text-[1rem] leading-snug text-ink-soft">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ind.color }} aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section className="rail px-5 py-10 sm:px-8">
        <h2 className="eyebrow">{ui.builds}</h2>
        <ol className="mt-6 grid gap-3">
          {copy.builds.map((b, i) => (
            <li key={b.title} className="glass flex gap-4 rounded-2xl p-5">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${ind.color} 18%, transparent)`, color: ind.color }}>
                <Icon name={b.icon} />
              </span>
              <div>
                <h3 className="font-display text-[1.1rem] font-bold leading-snug text-ink">
                  <span className="mr-2 font-mono text-[11px] text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                  {b.title}
                </h3>
                <p className="mt-1.5 text-[0.98rem] leading-snug text-ink-soft">{b.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rail px-5 py-10 sm:px-8">
        <h2 className="eyebrow">{ui.flow}</h2>
        <ol className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-3">
          {copy.flow.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold text-ink" style={{ borderColor: `color-mix(in srgb, ${ind.color} 55%, transparent)` }}>
                {step}
              </span>
              {i < copy.flow.length - 1 && (
                <span aria-hidden="true" className="text-ink-faint">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="rail px-5 py-10 sm:px-8">
        <h2 className="eyebrow">{ui.tools}</h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {copy.tools.map((t) => (
            <li key={t} className="rounded-md bg-white/[0.06] px-3 py-1.5 font-mono text-[12.5px] text-ink-soft">
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-10 rounded-2xl border px-5 py-4" style={{ borderColor: `color-mix(in srgb, ${ind.color} 38%, transparent)`, background: `color-mix(in srgb, ${ind.color} 9%, transparent)` }}>
          <h2 className="font-mono text-[11.5px] uppercase tracking-[0.14em]" style={{ color: ind.color }}>
            {ui.outcome}
          </h2>
          <p className="mt-2 text-[1.05rem] leading-snug text-ink">{copy.outcome}</p>
        </div>
      </section>

      <section className="rail px-5 pb-6 pt-10 sm:px-8">
        <h2 className="eyebrow">{ui.others}</h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {others.map((o) => (
            <li key={o.id}>
              <NavLink href={`/industries/${o.id}`} className="press inline-flex items-center gap-2 rounded-full border border-line-strong bg-white/[0.04] px-4 py-2 text-[13.5px] font-semibold text-ink no-underline hover:bg-white/[0.09]">
                <span className="h-2 w-2 rounded-full" style={{ background: o.color }} aria-hidden="true" />
                {o[l].name}
              </NavLink>
            </li>
          ))}
        </ul>
      </section>

      <FinalCta title={ui.ctaTitle} sub={ui.ctaSub} cta={ui.ctaButton} href={`/contact?industry=${ind.id}`} />
    </PageShell>
  );
}
