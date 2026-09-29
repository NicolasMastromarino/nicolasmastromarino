import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getPosts } from "@/lib/posts";

const PAGES = ["", "/services", "/about", "/case-studies", "/blog", "/contact"];

function localePath(locale: string, page: string) {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return `${prefix}${page}` || "/";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nicolasmastromarino.com";
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const page of PAGES) {
      entries.push({ url: `${base}${localePath(locale, page)}`, lastModified: new Date() });
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
