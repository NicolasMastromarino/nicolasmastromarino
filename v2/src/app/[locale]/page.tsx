import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CtaLink } from "@/components/cta-link";
import { INDUSTRIES } from "@/components/city/industries";
import { IndustriesPrompt } from "@/components/industries-prompt";
import { StatRow } from "@/components/stat-row";
import { SpotLink, SpotCard } from "@/components/spotlight";
import { NavLink } from "@/components/nav-link";
import { PageShell } from "@/components/page-shell";
import { FinalCta } from "@/components/final-cta";
import { Reveal, RevealWords, Stagger, StaggerItem } from "@/components/motion-primitives";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({
    locale,
    path: "",
    title: t("siteTitle"),
    description: t("siteDescription"),
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tNav = await getTranslations("nav");
  const tServices = await getTranslations("services");

  const stats = t.raw("stats") as { value: string; label: string }[];
  const proofItems = t.raw("proofItems") as { title: string; desc: string }[];
  const processSteps = tServices.raw("processSteps") as { title: string; desc: string }[];

  // The headline is two sentences; the second one gets the accent colour.
  const h1 = t("h1");
  const split = h1.indexOf(". ");
  const accentFrom = split === -1 ? undefined : h1.slice(0, split + 1).split(" ").length;

  return (
    <PageShell>
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-5 pb-12 pt-10 max-lg:pt-[40vh]! sm:px-8 sm:pt-14">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:min-h-[78vh]">
          <div>
            <Reveal y={10} immediate>
              <span className="eyebrow">{t("eyebrow")}</span>
            </Reveal>
            <RevealWords
              text={h1}
              accentFrom={accentFrom}
              immediate
              delay={0.1}
              className="mt-5 text-[2.3rem] leading-[1.02] sm:text-[3.2rem]"
            />
            <Reveal delay={0.5} immediate>
              <p className="mt-6 max-w-[52ch] text-[1.08rem] leading-relaxed text-ink-soft">
                {t("sub")}
              </p>
            </Reveal>
            <Reveal delay={0.62} immediate>
              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <CtaLink href="/contact">
                  {tNav("getInTouch")}
                </CtaLink>
                <CtaLink href="/services" variant="ghost">
                  {t("ctaSecondary")}
                </CtaLink>
              </div>
            </Reveal>
            <Reveal delay={0.74} immediate>
              <div className="mt-5">
                <IndustriesPrompt />
              </div>
            </Reveal>
            {/* one quiet static line instead of the flying chips: the tools are the proof, not the decoration */}
            <Reveal delay={0.86} immediate>
              <p className="mt-6 flex flex-wrap items-center gap-x-3.5 gap-y-1 font-mono text-[11.5px] uppercase tracking-[0.1em] text-ink-faint">
                <span>{t("worksWith")}:</span>
                {["GoHighLevel", "Zapier", "Kickserv", "Airtable", "Stripe"].map((tool) => (
                  <span key={tool} className="text-ink-soft">
                    {tool}
                  </span>
                ))}
              </p>
            </Reveal>
            <StatRow stats={stats} />

          </div>

        </div>
      </section>

      {/* Two tracks */}
      <section className="rail px-5 py-20 sm:px-8 sm:py-28">
        <RevealWords as="h2" text={t("tracksTitle")} className="max-w-lg text-[2rem] sm:text-[3rem]" />
        <Reveal delay={0.15}>
          <p className="mt-4 max-w-lg text-[1.02rem] text-ink-soft">{t("tracksSub")}</p>
        </Reveal>

        <Stagger className="mt-10 grid gap-4" gap={0.12}>
          {[
            {
              label: t("track1Label"),
              title: t("track1Title"),
              desc: t("track1Desc"),
              cta: (tServices.raw("track1Items") as { title: string }[])[0].title,
            },
            {
              label: t("track2Label"),
              title: t("track2Title"),
              desc: t("track2Desc"),
              cta: (tServices.raw("track2Items") as { title: string }[])[0].title,
            },
          ].map((track) => (
            <StaggerItem key={track.label} className="h-full">
              <SpotLink
                href="/services"
                className="group flex h-full flex-col gap-4 rounded-[var(--radius-lg)] p-8"
              >
                <span className="w-fit rounded-full border border-line-strong px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-accent-2">
                  {track.label}
                </span>
                <h3 className="font-display text-[1.6rem] font-extrabold leading-tight text-ink">
                  {track.title}
                </h3>
                <p className="text-[0.97rem] leading-relaxed text-ink-soft">{track.desc}</p>
                <span className="mt-auto flex items-center gap-2 pt-3 font-mono text-[12.5px] text-accent-text">
                  {track.cta}
                  <span className="transition-transform duration-300 ease-out-strong group-hover:translate-x-1.5">
                    →
                  </span>
                </span>
              </SpotLink>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.1} className="mt-8">
          <NavLink
            href="/services"
            className="link-draw pb-0.5 text-sm font-medium text-ink no-underline"
          >
            {t("tracksCta")} →
          </NavLink>
        </Reveal>
      </section>

      {/* Proof */}
      <section className="rail px-5 pb-6 pt-4 sm:px-8">
        <h2 className="eyebrow">{t("industriesTitle")}</h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {INDUSTRIES.map((i) => (
            <li key={i.id}>
              <NavLink href={`/industries/${i.id}`} className="press inline-flex items-center gap-2 rounded-full border border-line-strong bg-white/[0.04] px-4 py-2 text-[13.5px] font-semibold text-ink no-underline hover:bg-white/[0.09]">
                <span className="h-2 w-2 rounded-full" style={{ background: i.color }} aria-hidden="true" />
                {i[locale === "es" ? "es" : "en"].name}
              </NavLink>
            </li>
          ))}
        </ul>
      </section>

      <section className="py-10 sm:py-16">
        <div className="rail glass rounded-[var(--radius-lg)] px-6 py-12 sm:px-9">
          <RevealWords as="h2" text={t("proofTitle")} className="max-w-xl text-[2rem] sm:text-[3rem]" />
          <Reveal delay={0.15}>
            <p className="mt-4 max-w-xl text-[1.02rem] text-ink-soft">{t("proofSub")}</p>
          </Reveal>

          <Stagger className="mt-10 grid gap-4" gap={0.1}>
            {proofItems.map((item, i) => (
              <StaggerItem key={item.title} className="h-full">
                <SpotCard className="flex h-full flex-col gap-3 rounded-[var(--radius-md)] p-6">
                  <span className="font-mono text-[11.5px] text-accent-2">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-[1.25rem] font-extrabold text-ink">
                    {item.title}
                  </h3>
                  <p className="text-[0.93rem] leading-relaxed text-ink-soft">{item.desc}</p>
                </SpotCard>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal delay={0.1} className="mt-8">
            <NavLink
              href="/case-studies"
              className="link-draw pb-0.5 text-sm font-medium text-ink no-underline"
            >
              {t("caseStudiesCta")} →
            </NavLink>
          </Reveal>
        </div>
      </section>

      {/* Process teaser */}
      <section className="rail px-5 py-20 sm:px-8 sm:py-28">
        <span className="eyebrow">{t("processLabel")}</span>
        <RevealWords as="h2" text={t("processTitle")} className="mt-4 max-w-lg text-[2rem] sm:text-[3rem]" />
        <Stagger className="mt-10 flex flex-wrap gap-2.5" gap={0.08}>
          {processSteps.map((step, i) => (
            <StaggerItem key={step.title}>
              <span className="inline-flex items-center rounded-full border border-line-strong bg-surface px-4 py-2.5 font-mono text-xs text-ink-soft">
                <b className="mr-2 text-accent">{String(i + 1).padStart(2, "0")}</b>
                {step.title}
              </span>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <FinalCta title={t("finalTitle")} sub={t("finalSub")} cta={t("finalCta")} />
    </PageShell>
  );
}
