import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// NEXT_PUBLIC_BASE_PATH="/v2" serves the whole site under that path (a preview next to the live site).
// Leave it unset to serve from the root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  basePath,
  // a sub-path preview must never compete with the live site in search results
  // the root of a sub-path site goes to the default language (the middleware does not see it)
  async redirects() {
    if (!basePath) return [];
    return [{ source: "/", destination: "/en", permanent: false }];
  },
  async headers() {
    if (!basePath) return [];
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default withNextIntl(nextConfig);
