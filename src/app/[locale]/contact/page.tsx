import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactForm } from "@/components/contact-form";
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
    <section className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-16">
      <BreadcrumbSchema
        locale={locale}
        items={[
          { name: tNav("home"), path: "/" },
          { name: tNav("contact"), path: "/contact" },
        ]}
      />
      <h1 className="text-[2.1rem] leading-tight sm:text-[2.8rem]">{t("heroTitle")}</h1>
      <p className="mt-4 max-w-[60ch] text-[1.06rem] leading-relaxed text-ink-soft">
        {t("heroSub")}
      </p>

      <div className="mt-12 grid gap-6 rounded-[var(--radius-lg)] bg-ink p-6 sm:p-9 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10">
        <div className="text-bg">
          <span className="font-mono text-[12.5px] uppercase tracking-[0.12em] text-accent-3-on-ink">
            {t("bookingTitle")}
          </span>
          <p className="mt-3.5 text-[0.95rem] leading-relaxed text-bg/70">{t("bookingDesc")}</p>
          {bookingUrl ? (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-accent-ink no-underline hover:bg-accent-hover"
            >
              {t("bookingCta")}
            </a>
          ) : (
            <p className="mt-5 text-[0.9rem] text-bg/55">{t("bookingUnset")}</p>
          )}

          <div className="mt-7 flex flex-col gap-2.5 border-t border-bg/18 pt-7">
            <a
              href="mailto:nico@nicolasmastromarino.com"
              className="w-fit border-b border-bg/30 pb-0.5 text-[0.94rem] text-bg no-underline hover:border-accent"
            >
              nico@nicolasmastromarino.com
            </a>
            <a
              href="https://ar.linkedin.com/in/nicolasmastromarino"
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit border-b border-bg/30 pb-0.5 text-[0.94rem] text-bg no-underline hover:border-accent"
            >
              LinkedIn ↗
            </a>
          </div>
        </div>

        <ContactForm />
      </div>
    </section>
  );
}
