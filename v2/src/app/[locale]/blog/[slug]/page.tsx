import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { NavLink } from "@/components/nav-link";
import { PageShell } from "@/components/page-shell";
import { Reveal, RevealWords } from "@/components/motion-primitives";
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
    <PageShell>
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
        <div className="rail px-5 pb-20 pt-12 sm:px-8 sm:pt-20"><div className="glass rounded-[var(--radius-lg)] p-6 sm:p-10">
          <Reveal y={8}>
            <NavLink
              href="/blog"
              className="link-draw pb-0.5 font-mono text-xs text-ink-faint no-underline hover:text-ink"
            >
              ← {t("backToBlog")}
            </NavLink>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mt-8 font-mono text-xs text-ink-faint">
              {t("publishedOn")} {formatDate(post.published_at, locale)}
            </p>
          </Reveal>
          <RevealWords
            text={post.title}
            delay={0.15}
            className="mt-4 text-[2.1rem] leading-[1.04] sm:text-[3rem]"
          />

          <Reveal delay={0.4}>
            <div
              className="mt-10 max-w-none text-[16.5px] leading-[1.8] text-ink-soft [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:my-6 [&_blockquote]:rounded-lg [&_blockquote]:bg-white/[0.04] [&_blockquote]:px-5 [&_blockquote]:py-3 [&_blockquote]:text-ink [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_h2]:mb-3 [&_h2]:mt-12 [&_h2]:text-[1.6rem] [&_h2]:text-ink [&_h3]:mb-2 [&_h3]:mt-8 [&_h3]:text-[1.25rem] [&_h3]:text-ink [&_li]:mb-1.5 [&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-5 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </Reveal>
        </div></div>
      </article>
    </PageShell>
  );
}
