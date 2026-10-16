import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { CityCue } from "@/components/city/city-cue";
import { FinalCta } from "@/components/final-cta";
import { SpotCard } from "@/components/spotlight";
import { ProcessTimeline } from "@/components/process-timeline";
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
    path: "/services",
    title: t("servicesTitle"),
    description: t("servicesDescription"),
  });
}

type Item = { title: string; desc: string };

function Track({
  label,
  title,
  desc,
  items,
  tone,
}: {
  label: string;
  title: string;
  desc: string;
  items: Item[];
  tone: "a" | "b";
}) {
  return (
    <div className="rail my-10 px-5 sm:px-8">
      <div className="glass rounded-[var(--radius-lg)] p-6 sm:p-9">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <RevealWords as="h2" text={title} className="max-w-xl text-[1.9rem] sm:text-[2.7rem]" />
        <Reveal>
          <span className="eyebrow">{label}</span>
        </Reveal>
      </div>
      <Reveal delay={0.1}>
        <p className="mb-10 max-w-xl text-[1rem] text-ink-soft">{desc}</p>
      </Reveal>
      <Stagger className="grid gap-4 sm:grid-cols-2" gap={0.08}>
        {items.map((item, i) => (
          <StaggerItem key={item.title} className="h-full">
            <SpotCard className="flex h-full flex-col gap-2.5 rounded-[var(--radius-md)] p-6">
              <span
                className={`font-mono text-[11.5px] ${tone === "a" ? "text-accent-text" : "text-accent-2"}`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-[1.1rem] font-extrabold leading-snug text-ink">
                {item.title}
              </h3>
              <p className="text-[0.9rem] leading-relaxed text-ink-soft">{item.desc}</p>
            </SpotCard>
          </StaggerItem>
        ))}
      </Stagger>
      </div>
    </div>
  );
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("services");
  const tNav = await getTranslations("nav");

  const track1Items = t.raw("track1Items") as Item[];
  const track2Items = t.raw("track2Items") as Item[];
  const processSteps = t.raw("processSteps") as Item[];

  return (
    <PageShell>
      <BreadcrumbSchema
        locale={locale}
        items={[
          { name: tNav("home"), path: "/" },
          { name: tNav("services"), path: "/services" },
        ]}
      />
      <section className="rail px-5 pb-4 pt-12 sm:px-8 sm:pt-14 lg:min-h-[40vh]">
        <Reveal y={10} immediate>
          <span className="eyebrow">{tNav("services")}</span>
        </Reveal>
        <RevealWords
          text={t("heroTitle")}
          immediate
          delay={0.1}
          className="mt-5 max-w-[16ch] text-[2.6rem] leading-[1] sm:text-[4.4rem]"
        />
        <Reveal delay={0.4} immediate>
          <p className="mt-6 max-w-[60ch] text-[1.08rem] leading-relaxed text-ink-soft">
            {t("heroSub")}
          </p>
        </Reveal>
      </section>

      <CityCue cue="crm">
      <Track
        tone="a"
        label={t("track1Label")}
        title={t("track1Title")}
        desc={t("track1Desc")}
        items={track1Items}
      />
      </CityCue>

      <CityCue cue="auto">
      <div>
        <Track
          tone="b"
          label={t("track2Label")}
          title={t("track2Title")}
          desc={t("track2Desc")}
          items={track2Items}
        />
      </div>
      </CityCue>

      <CityCue cue="process">
      <section id="process" className="rail scroll-mt-28 px-5 py-20 sm:px-8 sm:py-28">
        <span className="eyebrow">{t("processLabel")}</span>
        <RevealWords as="h2" text={t("processTitle")} className="mt-4 max-w-lg text-[1.9rem] sm:text-[2.7rem]" />
        <Reveal delay={0.1}>
          <p className="mb-14 mt-4 max-w-xl text-[1rem] text-ink-soft">{t("processSub")}</p>
        </Reveal>
        <ProcessTimeline steps={processSteps} />
      </section>
      </CityCue>

      <FinalCta title={t("ctaTitle")} sub={t("ctaSub")} cta={t("cta")} />
    </PageShell>
  );
}
