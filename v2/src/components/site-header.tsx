import { getTranslations } from "next-intl/server";
import { HeaderNav } from "@/components/header-nav";

export async function SiteHeader() {
  const t = await getTranslations("nav");

  const links = [
    { href: "/services", label: t("services") },
    { href: "/case-studies", label: t("caseStudies") },
    { href: "/about", label: t("about") },
    { href: "/contact", label: t("contact") },
  ];

  return (
    <HeaderNav
      links={links}
      contactLabel={t("getInTouch")}
      menuLabel={t("menu")}
      navLabel={t("primary")}
    />
  );
}
