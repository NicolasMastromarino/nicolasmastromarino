import { getTranslations, setRequestLocale } from "next-intl/server";
import { CtaLink } from "@/components/cta-link";
import { CaseStudyDiagram } from "@/components/case-study-diagram";

type CaseStudy = {
  id: string;
  ticket: string;
  title: string;
  context: string;
  work: string;
  outcome: string;
};

export default async function CaseStudiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("caseStudies");
  const items = t.raw("items") as CaseStudy[];

  return (
    <>
      <section className="mx-auto max-w-3xl px-5 pb-4 pt-14 sm:px-8 sm:pt-16">
        <h1 className="text-[2.1rem] leading-tight sm:text-[2.8rem]">{t("heroTitle")}</h1>
        <p className="mt-4 max-w-[60ch] text-[1.06rem] leading-relaxed text-ink-soft">
          {t("heroSub")}
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-14 sm:px-8">
        <div className="flex flex-col gap-5">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-[var(--radius-lg)] border border-line bg-surface p-7 sm:p-9"
            >
              <span className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-accent-2">
                {item.ticket}
              </span>

              <h2 className="mt-2.5 text-[1.3rem] leading-snug sm:text-[1.5rem]">
                {item.title}
              </h2>

              <div className="mt-6">
                <CaseStudyDiagram variant={item.id} />
              </div>

              <dl className="grid gap-6 border-t border-line pt-7 sm:grid-cols-3">
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
                    Context
                  </dt>
                  <dd className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                    {item.context}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
                    The work
                  </dt>
                  <dd className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                    {item.work}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-wide text-accent-text">
                    Outcome
                  </dt>
                  <dd className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                    {item.outcome}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
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
