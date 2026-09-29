import type { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nicolasmastromarino.com";

export function pageMetadata({
  locale,
  path,
  title,
  description,
}: {
  locale: string;
  path: string;
  title: string;
  description: string;
}): Metadata {
  const enPath = path || "/";
  const esPath = `/es${path}`;
  const canonicalPath = locale === "es" ? esPath : enPath;
  const canonicalUrl = new URL(canonicalPath, SITE_URL).toString();
  const ogImage = `${SITE_URL}/api/og?title=${encodeURIComponent(title)}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: { en: enPath, es: esPath },
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      locale,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
  };
}
