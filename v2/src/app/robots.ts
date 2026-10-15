import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/base-path";

export default function robots(): MetadataRoute.Robots {
  // a sub-path preview stays out of search results
  if (BASE_PATH) return { rules: { userAgent: "*", disallow: "/" } };
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://nicolasmastromarino.com";
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${base}/sitemap.xml`,
  };
}
