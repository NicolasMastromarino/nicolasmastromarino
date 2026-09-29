import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { Link } from "@/i18n/navigation";
import { getPost } from "@/lib/posts";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ArticleSchema, BreadcrumbSchema } from "@/components/json-ld";

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
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPost(locale, slug);
  if (!post) return {};
  return pageMetadata({
    locale,
    path: `/blog/${slug}`,
    title: post.meta_title ?? post.title,
    description: post.meta_description ?? post.excerpt,
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("blog");
  const tNav = await getTranslations("nav");
  const post = await getPost(locale, slug);

  if (!post) {
    notFound();
  }

  const html = await marked.parse(post.content);

  return (
    <article>
      <BreadcrumbSchema
        locale={locale}
        items={[
          { name: tNav("home"), path: "/" },
          { name: tNav("blog"), path: "/blog" },
          { name: post.title, path: `/blog/${slug}` },
        ]}
      />
      <ArticleSchema
        title={post.title}
        description={post.meta_description ?? post.excerpt}
        datePublished={post.published_at}
        path={locale === "es" ? `/es/blog/${slug}` : `/blog/${slug}`}
      />
      <div className="mx-auto max-w-2xl px-5 py-14 sm:px-8 sm:py-16">
        <Link
          href="/blog"
          className="font-mono text-xs text-ink-faint no-underline hover:text-accent"
        >
          ← {t("backToBlog")}
        </Link>

        <p className="mt-6 font-mono text-xs text-ink-faint">
          {t("publishedOn")} {formatDate(post.published_at, locale)}
        </p>
        <h1 className="mt-3 text-[1.9rem] leading-tight sm:text-[2.4rem]">
          {post.title}
        </h1>

        <div
          className="prose-post mt-9 max-w-none text-[16px] leading-[1.75] text-ink-soft [&_a]:text-accent [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink [&_p]:mb-5 [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:text-ink [&_strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </article>
  );
}
