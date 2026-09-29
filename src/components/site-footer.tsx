import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations();
  const year = new Date().getFullYear();

  const links = [
    { href: "/services", label: t("nav.services") },
    { href: "/case-studies", label: t("nav.caseStudies") },
    { href: "/about", label: t("nav.about") },
    { href: "/blog", label: t("nav.blog") },
    { href: "/contact", label: t("nav.contact") },
  ];

  return (
    <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3.5 px-5 py-10 text-[13px] text-ink-faint sm:px-8">
      <span>
        © {year} Nicolás Mastromarino. {t("footer.rights")}
      </span>
      <div className="flex flex-wrap items-center gap-4.5 gap-x-5">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-ink-soft no-underline hover:text-accent"
          >
            {link.label}
          </Link>
        ))}
        <a
          href="https://ar.linkedin.com/in/nicolasmastromarino"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-soft no-underline hover:text-accent"
        >
          LinkedIn ↗
        </a>
      </div>
    </footer>
  );
}
