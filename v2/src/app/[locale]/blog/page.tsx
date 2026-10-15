import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NavLink } from "@/components/nav-link";
import { PageShell } from "@/components/page-shell";
import { Reveal, RevealWords, Stagger, StaggerItem } from "@/components/motion-primitives";
import { getPosts } from "@/lib/posts";
import { pageMetadata } from "@/lib/seo";
import { BreadcrumbSchema } from "@/components/json-ld";

function formatDate(dateStr: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "es" ? "es-AR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateStr));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({
    locale,
    path: "/blog",
    title: t("blogTitle"),
    description: t("blogDescription"),
  });
}

export default async function BlogIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const tNav = await getTranslations("nav");
  const posts = await getPosts(locale);

  return (
    <PageShell>
      <BreadcrumbSchema
        locale={locale}
        items={[
          { name: tNav("home"), path: "/" },
          { name: tNav("blog"), path: "/blog" },
        ]}
      />
      <section className="rail px-5 pb-20 pt-12 sm:px-8 sm:pt-20">
        <Reveal y={10} immediate>
          <span className="eyebrow">{tNav("blog")}</span>
        </Reveal>
        <RevealWords
          text={t("heroTitle")}
          immediate
          delay={0.1}
          className="mt-5 max-w-[18ch] text-[2.6rem] leading-[1] sm:text-[4.2rem]"
        />
        <Reveal delay={0.4} immediate>
          <p className="mt-6 max-w-[60ch] text-[1.08rem] leading-relaxed text-ink-soft">
            {t("heroSub")}
          </p>
        </Reveal>

        {posts.length === 0 ? (
          <Reveal delay={0.5} className="mt-14">
            <div className="rounded-[var(--radius-md)] border border-dashed border-line-strong p-10 text-center">
              <p className="font-mono text-sm text-ink-faint">{t("empty")}</p>
              <NavLink
                href="/contact"
                className="link-draw mt-4 inline-block pb-0.5 text-sm font-medium text-accent-text no-underline"
              >
                {t("emptyCta")} →
              </NavLink>
            </div>
          </Reveal>
        ) : (
          <Stagger className="mt-14 border-t border-line" gap={0.08} delay={0.3}>
            {posts.map((post, i) => (
              <StaggerItem key={post.slug}>
                <NavLink
                  href={`/blog/${post.slug}`}
                  className="group relative grid gap-3 border-b border-line py-8 no-underline sm:grid-cols-[auto_1fr_auto] sm:items-baseline sm:gap-8"
                >
                  <span className="font-mono text-xs text-accent-2">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="font-mono text-xs text-ink-faint">
                      {t("publishedOn")} {formatDate(post.published_at, locale)}
                    </p>
                    <h2 className="mt-2 text-[1.35rem] leading-snug text-ink transition-colors duration-200 group-hover:text-accent-text sm:text-[1.7rem]">
                      {post.title}
                    </h2>
                    <p className="mt-2.5 max-w-[60ch] text-[0.97rem] leading-relaxed text-ink-soft">
                      {post.excerpt}
                    </p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="hidden font-mono text-lg text-ink-faint transition-[transform,color] duration-300 ease-out-strong group-hover:translate-x-1.5 group-hover:text-accent sm:block"
                  >
                    →
                  </span>
                </NavLink>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>
    </PageShell>
  );
}
