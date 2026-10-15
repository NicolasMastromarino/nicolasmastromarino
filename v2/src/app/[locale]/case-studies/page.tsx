import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { FinalCta } from "@/components/final-cta";
import { CaseStudyStack, type CaseStudy } from "@/components/case-study-stack";
import { Reveal, RevealWords } from "@/components/motion-primitives";
import { pageMetadata } from "@/lib/seo";
import { BreadcrumbSchema } from "@/components/json-ld";
import { withBase } from "@/lib/base-path";

const PDF_BY_ID: Record<string, string> = {
  "dispatch-integration": withBase("/crm-automation-case-study-gohighlevel-zapier.pdf"),
  "agency-automation": withBase("/marketing-automation-case-study-agency.pdf"),
  "bookkeeply-saas": withBase("/bookkeeply-case-study.pdf"),
  "jbz-beats-store": withBase("/jbzbeats-case-study.pdf"),
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({
    locale,
    path: "/case-studies",
    title: t("caseStudiesTitle"),
    description: t("caseStudiesDescription"),
  });
}

export default async function CaseStudiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("caseStudies");
  const tNav = await getTranslations("nav");
  const items = t.raw("items") as CaseStudy[];

  return (
    <PageShell>
      <BreadcrumbSchema
        locale={locale}
        items={[
          { name: tNav("home"), path: "/" },
          { name: tNav("caseStudies"), path: "/case-studies" },
        ]}
      />
      <section className="mx-auto max-w-5xl px-5 pb-4 pt-12 sm:px-8 sm:pt-20 lg:min-h-[70vh]">
        <Reveal y={10} immediate>
          <span className="eyebrow">{tNav("caseStudies")}</span>
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

      <section className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-20 lg:ml-[max(2rem,calc((100vw-64rem)/2))] lg:mr-auto lg:max-w-[640px] lg:px-0">
        <CaseStudyStack
          items={items}
          pdfById={PDF_BY_ID}
          labels={{
            context: t("labelContext"),
            work: t("labelWork"),
            outcome: t("labelOutcome"),
            download: t("downloadPdf"),
          }}
        />
      </section>

      <FinalCta title={t("ctaTitle")} sub={t("ctaSub")} cta={t("cta")} />
    </PageShell>
  );
}
