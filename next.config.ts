import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// /v2 is a second site (the folder v2/ of this repo, deployed as its own Vercel project).
// It is served from this domain by a rewrite; nothing on the current site links to it.
// V2_ORIGIN is that project's address, without a trailing slash. Set it to an empty string in the environment to switch /v2 off.
const V2_ORIGIN = process.env.V2_ORIGIN ?? "https://nicolasmastromarino-v2.vercel.app";

const nextConfig: NextConfig = {
  async rewrites() {
    if (!V2_ORIGIN) return [];
    return [
      { source: "/v2", destination: `${V2_ORIGIN}/v2` },
      { source: "/v2/:path*", destination: `${V2_ORIGIN}/v2/:path*` },
    ];
  },
};

export default withNextIntl(nextConfig);
