import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPosts } from "@/lib/posts";

function formatDate(dateStr: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "es" ? "es-AR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateStr));
}

export default async function BlogIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const posts = await getPosts(locale);

  return (
    <section>
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
