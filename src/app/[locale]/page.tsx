import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CtaLink } from "@/components/cta-link";
import { StatRow } from "@/components/stat-row";
import { IntegrationDiagram, IntegrationDiagramCompact } from "@/components/integration-diagram";
import { ToolsMarquee } from "@/components/tools-marquee";
import { TeaserCard } from "@/components/teaser-card";
import { CapCard } from "@/components/cap-card";
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
  const hasBooking = Boolean(process.env.NEXT_PUBLIC_BOOKING_URL);

  const stats = t.raw("stats") as { value: string; label: string }[];
  const proofItems = t.raw("proofItems") as { title: string; desc: string }[];
  const processSteps = tServices.raw("processSteps") as { title: string; desc: string }[];
  const diagramCopy = {
    title: t("diagramTitle"),
    ariaLabel: t("diagramAriaLabel"),
    one: t("diagramOne"),
    system: t("diagramSystem"),
    outcome1: t("diagramOutcome1"),
    outcome2: t("diagramOutcome2"),
  };

  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-5 pb-10 pt-14 sm:px-8 sm:pt-16">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="animate-rise-in">
            <h1 className="text-[2.3rem] leading-[1.03] sm:text-[3.1rem]">{t("h1")}</h1>
            <p className="mt-5 max-w-[52ch] text-[1.08rem] leading-relaxed text-ink-soft">
              {t("sub")}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3.5">
              <CtaLink href="/contact">{hasBooking ? tNav("bookCall") : tNav("getInTouch")}</CtaLink>
              <CtaLink href="/services" variant="ghost">
                {t("ctaSecondary")}
              </CtaLink>
            </div>
            <StatRow stats={stats} />

            <div className="mt-9 lg:hidden">
              <IntegrationDiagramCompact copy={diagramCopy} />
            </div>
          </div>

          <div className="hidden lg:block">
            <IntegrationDiagram copy={diagramCopy} />
          </div>
        </div>
      </section>

      <ToolsMarquee />

      {/* Two tracks */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
        <h2 className="max-w-lg text-[1.7rem] sm:text-[2.2rem]">{t("tracksTitle")}</h2>
        <p className="mt-3.5 max-w-lg text-[1.02rem] text-ink-soft">{t("tracksSub")}</p>

        <div className="mt-11 grid gap-4 sm:grid-cols-2">
          <TeaserCard
            href="/services"
            label={t("track1Label")}
            title={t("track1Title")}
            desc={t("track1Desc")}
            cta={tServices.raw("track1Items")[0].title}
          />
          <TeaserCard
            href="/services"
            label={t("track2Label")}
            title={t("track2Title")}
            desc={t("track2Desc")}
            cta={tServices.raw("track2Items")[0].title}
          />
        </div>

        <div className="mt-7">
          <Link href="/services" className="text-sm font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent">
            {t("tracksCta")} →
          </Link>
        </div>
      </section>

      {/* Proof */}
      <section className="border-t border-line bg-surface-2">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="max-w-xl text-[1.7rem] sm:text-[2.2rem]">{t("proofTitle")}</h2>
          <p className="mt-3.5 max-w-xl text-[1.02rem] text-ink-soft">{t("proofSub")}</p>

          <div className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {proofItems.map((item, i) => (
              <CapCard key={item.title} num={String(i + 1).padStart(2, "0")} title={item.title} desc={item.desc} />
            ))}
          </div>

          <div className="mt-7">
            <Link href="/case-studies" className="text-sm font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent">
              {t("caseStudiesCta")} →
            </Link>
          </div>
        </div>
      </section>

      {/* Process teaser */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
        <h2 className="max-w-lg text-[1.7rem] sm:text-[2.2rem]">{t("processTitle")}</h2>
        <div className="mt-7 flex flex-wrap gap-2.5">
          {processSteps.map((step, i) => (
            <span
              key={step.title}
              className="rounded-full border border-line bg-surface px-3.5 py-2 font-mono text-xs text-ink-soft"
            >
              <b className="mr-1.5 text-accent">{String(i + 1).padStart(2, "0")}</b>
              {step.title}
            </span>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-5xl px-5 pb-20 sm:px-8">
        <div className="flex flex-col items-start gap-6 rounded-[var(--radius-lg)] bg-ink px-9 py-11 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="max-w-[22ch] text-[1.6rem] text-bg sm:text-[2.1rem]">{t("finalTitle")}</h2>
            <p className="mt-2.5 max-w-md text-[0.95rem] text-bg/65">{t("finalSub")}</p>
          </div>
          <CtaLink href="/contact">{t("finalCta")}</CtaLink>
        </div>
      </section>
    </>
  );
}
