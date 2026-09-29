import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CtaLink } from "@/components/cta-link";
import { ToolsMarquee } from "@/components/tools-marquee";
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
  const hasBooking = Boolean(process.env.NEXT_PUBLIC_BOOKING_URL);

  const facts = t.raw("facts") as { title: string; dates: string; desc: string }[];

  return (
    <>
      <BreadcrumbSchema
        locale={locale}
        items={[
          { name: tNav("home"), path: "/" },
          { name: tNav("about"), path: "/about" },
        ]}
      />
      <section className="mx-auto max-w-3xl px-5 pb-4 pt-14 sm:px-8 sm:pt-16">
        <div className="flex flex-col-reverse gap-8 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-[2.1rem] leading-tight sm:text-[2.8rem]">{t("heroTitle")}</h1>
            <p className="mt-5 text-[1.1rem] leading-relaxed text-ink-soft">{t("intro")}</p>
          </div>
          <div className="relative h-56 w-44 flex-none self-center overflow-hidden rounded-[var(--radius-lg)] border border-line shadow-[var(--shadow)] sm:self-start">
            <Image
              src="/nicolas-mastromarino-crm-automation-consultant.jpg"
              alt={t("photoAlt")}
              fill
              sizes="176px"
              className="object-cover"
              style={{ objectPosition: "50% 22%" }}
              priority
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
        <div className="flex flex-col gap-11">
          <div>
            <h2 className="text-[1.3rem] sm:text-[1.5rem]">{t("body1Title")}</h2>
            <p className="mt-3.5 text-[0.98rem] leading-relaxed text-ink-soft">{t("body1")}</p>
          </div>
          <div>
            <h2 className="text-[1.3rem] sm:text-[1.5rem]">{t("body2Title")}</h2>
            <p className="mt-3.5 text-[0.98rem] leading-relaxed text-ink-soft">{t("body2")}</p>
          </div>
          <div>
            <h2 className="text-[1.3rem] sm:text-[1.5rem]">{t("body3Title")}</h2>
            <p className="mt-3.5 text-[0.98rem] leading-relaxed text-ink-soft">{t("body3")}</p>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-surface-2">
        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
          <h2 className="mb-7 text-[1.3rem] sm:text-[1.5rem]">{t("factsTitle")}</h2>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.title} className="rounded-[var(--radius-md)] border border-line bg-surface p-5">
                <h3 className="text-[1rem] font-semibold text-ink">{fact.title}</h3>
                <span className="font-mono text-[11.5px] text-ink-faint">{fact.dates}</span>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-soft">{fact.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pt-14 sm:px-8">
        <h2 className="mb-6 text-[1.3rem] sm:text-[1.5rem]">{t("toolsTitle")}</h2>
      </section>
      <div className="pb-14">
        <ToolsMarquee />
      </div>

      <section className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-8">
        <h2 className="text-[1.6rem] sm:text-[2rem]">{t("ctaTitle")}</h2>
        <div className="mt-7">
          <CtaLink href="/contact">{hasBooking ? t("cta") : tNav("getInTouch")}</CtaLink>
        </div>
      </section>
    </>
  );
}
