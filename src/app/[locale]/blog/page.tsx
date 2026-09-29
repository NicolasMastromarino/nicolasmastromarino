import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
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
    <section>
      <BreadcrumbSchema
        locale={locale}
        items={[
          { name: tNav("home"), path: "/" },
          { name: tNav("blog"), path: "/blog" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-5 pb-4 pt-14 sm:px-8 sm:pt-16">
        <h1 className="text-[2.1rem] leading-tight sm:text-[2.8rem]">{t("heroTitle")}</h1>
        <p className="mt-4 max-w-[60ch] text-[1.06rem] leading-relaxed text-ink-soft">
          {t("heroSub")}
        </p>

        {posts.length === 0 ? (
          <div className="mt-14 rounded-[var(--radius-md)] border border-dashed border-line-strong p-10 text-center">
            <p className="font-mono text-sm text-ink-faint">{t("empty")}</p>
            <Link
              href="/contact"
              className="mt-4 inline-block text-sm font-medium text-accent no-underline hover:text-accent-hover"
            >
              {t("emptyCta")} →
            </Link>
          </div>
        ) : (
          <div className="mt-14 divide-y divide-line border-y border-line">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block py-6 no-underline"
              >
                <p className="font-mono text-xs text-ink-faint">
                  {t("publishedOn")} {formatDate(post.published_at, locale)}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-ink">{post.title}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                  {post.excerpt}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
