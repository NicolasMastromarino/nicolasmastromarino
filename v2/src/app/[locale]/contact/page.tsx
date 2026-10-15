import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactForm } from "@/components/contact-form";
import { PageShell } from "@/components/page-shell";
import { Reveal, RevealWords } from "@/components/motion-primitives";
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
    path: "/contact",
    title: t("contactTitle"),
    description: t("contactDescription"),
  });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contact");
  const tNav = await getTranslations("nav");
  const bookingUrl = process.env.NEXT_PUBLIC_BOOKING_URL;

  return (
    <PageShell>
      <section className="rail-right rail px-5 pb-16 pt-12 sm:px-8 sm:pt-20">
        <BreadcrumbSchema
          locale={locale}
          items={[
            { name: tNav("home"), path: "/" },
            { name: tNav("contact"), path: "/contact" },
          ]}
        />
        <Reveal y={10} immediate>
          <span className="eyebrow">{tNav("contact")}</span>
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

        <Reveal delay={0.5} y={30} className="mt-14">
          <div className="relative grid gap-8 overflow-hidden rounded-[var(--radius-lg)] border border-line-strong bg-surface p-6 sm:p-10 ">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-24 -top-24 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(255,91,61,0.22),transparent_65%)] blur-2xl"
            />
            <div className="relative">
              <span className="eyebrow">{t("bookingTitle")}</span>
              <p className="mt-4 text-[0.97rem] leading-relaxed text-ink-soft">{t("bookingDesc")}</p>
              {bookingUrl ? (
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-3 text-[14px] font-semibold text-accent-ink no-underline hover:bg-accent-hover"
                >
                  {t("bookingCta")}
                </a>
              ) : (
                <p className="mt-6 text-[0.9rem] text-ink-faint">{t("bookingUnset")}</p>
              )}

              <div className="mt-8 flex flex-col items-start gap-3 border-t border-line pt-8">
                <a
                  href="mailto:nico@nicolasmastromarino.com"
                  className="link-draw pb-0.5 text-[0.98rem] text-ink no-underline"
                >
                  nico@nicolasmastromarino.com
                </a>
                <a
                  href="https://ar.linkedin.com/in/nicolasmastromarino"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-draw pb-0.5 text-[0.98rem] text-ink no-underline"
                >
                  LinkedIn ↗
                </a>
              </div>
            </div>

            <div className="relative">
              <ContactForm />
            </div>
          </div>
        </Reveal>
      </section>
    </PageShell>
  );
}
