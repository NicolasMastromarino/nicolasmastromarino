import { getTranslations } from "next-intl/server";
import { HeaderNav } from "@/components/header-nav";

export async function SiteHeader() {
  const t = await getTranslations("nav");

  const links = [
    { href: "/services", label: t("services") },
    { href: "/case-studies", label: t("caseStudies") },
    { href: "/about", label: t("about") },
    { href: "/blog", label: t("blog") },
    { href: "/contact", label: t("contact") },
  ];

  const hasBooking = Boolean(process.env.NEXT_PUBLIC_BOOKING_URL);

  return (
    <HeaderNav links={links} bookCallLabel={hasBooking ? t("bookCall") : t("getInTouch")} />
  );
}
