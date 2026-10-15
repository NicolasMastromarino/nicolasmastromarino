import { defineRouting } from "next-intl/routing";
import { BASE_PATH } from "@/lib/base-path";

export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  // under a sub-path the root of the site never reaches the middleware, so the language is always in the URL there
  localePrefix: BASE_PATH ? "always" : "as-needed",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
