import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getPosts } from "@/lib/posts";

const PAGES = ["", "/services", "/about", "/case-studies", "/blog", "/contact"];

// Fixed per-page launch/last-major-edit dates. Static marketing pages don't
// track their own change history, so this stays stable across builds
// instead of reporting "changed today" on every deploy. Bump a page's date
// here when its content meaningfully changes.
const LAST_MODIFIED: Record<string, string> = {
  "": "2026-09-29",
  "/services": "2026-09-29",
  "/about": "2026-09-29",
  "/case-studies": "2026-09-29",
  "/blog": "2026-09-29",
  "/contact": "2026-09-29",
};

function localePath(locale: string, page: string) {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${prefix}${page}` || "/";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nicolasmastromarino.com";
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const page of PAGES) {
      entries.push({
        url: `${base}${localePath(locale, page)}`,
        lastModified: LAST_MODIFIED[page],
      });
    }
    const posts = await getPosts(locale);
    for (const post of posts) {
      entries.push({
        url: `${base}${localePath(locale, `/blog/${post.slug}`)}`,
        lastModified: post.published_at,
      });
    }
  }

  return entries;
}
