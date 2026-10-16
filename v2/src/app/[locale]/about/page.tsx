import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AboutPhoto } from "@/components/about-photo";
import { PageShell } from "@/components/page-shell";
import { FinalCta } from "@/components/final-cta";
import { SpotCard } from "@/components/spotlight";
import { Reveal, RevealWords, Stagger, StaggerItem } from "@/components/motion-primitives";
import { pageMetadata } from "@/lib/seo";
import { BreadcrumbSchema } from "@/components/json-ld";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({
    locale,
    path: "/about",
    title: t("aboutTitle"),
    description: t("aboutDescription"),
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const tNav = await getTranslations("nav");

  const facts = t.raw("facts") as { title: string; dates: string; desc: string }[];
  const bodies = [
    { title: t("body1Title"), body: t("body1") },
    { title: t("body2Title"), body: t("body2") },
    { title: t("body3Title"), body: t("body3") },
  ];

  return (
    <PageShell>
      <BreadcrumbSchema
        locale={locale}
        items={[
          { name: tNav("home"), path: "/" },
          { name: tNav("about"), path: "/about" },
        ]}
      />
      <section className="mx-auto max-w-5xl px-5 pb-6 pt-12 sm:px-8 sm:pt-20">
        <div className="flex flex-col-reverse gap-10 sm:flex-row sm:items-start sm:justify-between sm:gap-14">
          <div className="max-w-xl">
            <Reveal y={10} immediate>
              <span className="eyebrow">{tNav("about")}</span>
            </Reveal>
            <RevealWords
              text={t("heroTitle")}
              immediate
              delay={0.1}
              className="mt-5 text-[2.4rem] leading-[1] sm:text-[3.8rem]"
            />
            <Reveal delay={0.45} immediate>
              <p className="mt-6 text-[1.08rem] leading-relaxed text-ink-soft">{t("intro")}</p>
            </Reveal>
          </div>
          <AboutPhoto alt={t("photoAlt")} />
        </div>
      </section>

      <section className="rail px-5 py-16 sm:px-8 sm:py-24">
        <div className="flex flex-col gap-16">
          {bodies.map((b, i) => (
            <Reveal key={b.title}>
              <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:gap-9">
                <span className="font-mono text-[12px] text-accent-2">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2 className="text-[1.5rem] sm:text-[2rem]">{b.title}</h2>
                  <p className="mt-4 text-[1rem] leading-relaxed text-ink-soft">{b.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="py-10">
        <div className="rail glass rounded-[var(--radius-lg)] px-6 py-12 sm:px-9">
          <RevealWords as="h2" text={t("factsTitle")} className="mb-10 text-[1.9rem] sm:text-[2.6rem]" />
          <Stagger className="grid gap-4 sm:grid-cols-2" gap={0.08}>
            {facts.map((fact) => (
              <StaggerItem key={fact.title} className="h-full">
                <SpotCard className="h-full rounded-[var(--radius-md)] p-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-display text-[1.15rem] font-extrabold text-ink">
                      {fact.title}
                    </h3>
                    <span className="font-mono text-[11.5px] text-ink-faint">{fact.dates}</span>
                  </div>
                  <p className="mt-2.5 text-[0.93rem] leading-relaxed text-ink-soft">{fact.desc}</p>
                </SpotCard>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <div className="pb-6" />

      <FinalCta
        title={t("ctaTitle")}
        cta={tNav("getInTouch")}
      />
    </PageShell>
  );
}
