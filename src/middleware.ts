import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // /v2 is the second site, served by its own project through a rewrite: this middleware leaves it alone
  matcher: ["/((?!api|trpc|_next|_vercel|v2(?:/|$)|.*\\..*).*)"],
};
