import { getTranslations, setRequestLocale } from "next-intl/server";
import { CtaLink } from "@/components/cta-link";
import { CapCard } from "@/components/cap-card";
import { LabelDot } from "@/components/label-dot";
import { ProcessRail } from "@/components/process-rail";

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("services");

  const track1Items = t.raw("track1Items") as { title: string; desc: string }[];
  const track2Items = t.raw("track2Items") as { title: string; desc: string }[];
  const processSteps = t.raw("processSteps") as { title: string; desc: string }[];

  return (
    <>
      <section className="mx-auto max-w-3xl px-5 pb-4 pt-14 sm:px-8 sm:pt-16">
        <h1 className="text-[2.1rem] leading-tight sm:text-[2.8rem]">{t("heroTitle")}</h1>
        <p className="mt-4 max-w-[60ch] text-[1.06rem] leading-relaxed text-ink-soft">
          {t("heroSub")}
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-[1.5rem] sm:text-[1.8rem]">{t("track1Title")}</h2>
          <LabelDot>{t("track1Label")}</LabelDot>
        </div>
        <p className="mb-9 max-w-xl text-[0.98rem] text-ink-soft">{t("track1Desc")}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {track1Items.map((item, i) => (
            <CapCard key={item.title} num={String(i + 1).padStart(2, "0")} title={item.title} desc={item.desc} />
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-surface-2">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-[1.5rem] sm:text-[1.8rem]">{t("track2Title")}</h2>
            <LabelDot>{t("track2Label")}</LabelDot>
          </div>
          <p className="mb-9 max-w-xl text-[0.98rem] text-ink-soft">{t("track2Desc")}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {track2Items.map((item, i) => (
              <CapCard key={item.title} num={String(i + 1).padStart(2, "0")} title={item.title} desc={item.desc} />
            ))}
          </div>
        </div>
      </section>

      <section id="process" className="mx-auto max-w-5xl scroll-mt-24 px-5 py-16 sm:px-8">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-4">
          <h2 className="max-w-lg text-[1.6rem] sm:text-[2rem]">{t("processTitle")}</h2>
          <LabelDot>{t("processLabel")}</LabelDot>
        </div>
        <p className="mb-12 max-w-xl text-[0.98rem] text-ink-soft">{t("processSub")}</p>
        <ProcessRail steps={processSteps} />
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-20 sm:px-8">
        <div className="flex flex-col items-start gap-6 rounded-[var(--radius-lg)] bg-ink px-9 py-11 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="max-w-[22ch] text-[1.6rem] text-bg sm:text-[2.1rem]">{t("ctaTitle")}</h2>
            <p className="mt-2.5 max-w-md text-[0.95rem] text-bg/65">{t("ctaSub")}</p>
          </div>
          <CtaLink href="/contact">{t("cta")}</CtaLink>
        </div>
      </section>
    </>
  );
}
