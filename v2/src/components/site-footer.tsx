import { getTranslations } from "next-intl/server";
import { NavLink } from "@/components/nav-link";
import { Reveal } from "@/components/motion-primitives";

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
    <footer className="glass relative mt-10 overflow-hidden border-x-0 border-b-0">
      <div className="mx-auto max-w-5xl px-5 pb-10 pt-16 sm:px-8">
        <Reveal>
          <p className="max-w-md font-display text-[1.5rem] font-extrabold leading-tight text-ink sm:text-[1.9rem]">
            {t("footer.tagline")}
          </p>
          <a
            href="mailto:nico@nicolasmastromarino.com"
            className="link-draw mt-4 inline-block pb-0.5 font-mono text-sm text-accent-text no-underline"
          >
            nico@nicolasmastromarino.com
          </a>
        </Reveal>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 text-[13px] text-ink-faint">
          <span>
            © {year} Nicolás Mastromarino. {t("footer.rights")}
          </span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {links.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                className="link-draw pb-0.5 text-ink-soft no-underline hover:text-ink"
              >
                {link.label}
              </NavLink>
            ))}
            <a
              href="https://ar.linkedin.com/in/nicolasmastromarino"
              target="_blank"
              rel="noopener noreferrer"
              className="link-draw pb-0.5 text-ink-soft no-underline hover:text-ink"
            >
              LinkedIn ↗
            </a>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none select-none whitespace-nowrap text-center font-display text-[22vw] font-extrabold leading-[0.78] tracking-tighter outline-text"
        style={{ marginBottom: "-0.06em", maskImage: "linear-gradient(to bottom, #000 30%, transparent 95%)" }}
      >
        Nicolás M.
      </div>
    </footer>
  );
}
