"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Link, usePathname } from "@/i18n/navigation";
import { NavLink } from "@/components/nav-link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { EASE_OUT } from "@/components/motion-primitives";

type NavLinkItem = { href: string; label: string };

export function HeaderNav({
  links,
  bookCallLabel,
  menuLabel,
  navLabel,
}: {
  links: NavLinkItem[];
  bookCallLabel: string;
  menuLabel: string;
  navLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the menu on navigation and lock page scroll while it is open.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        burgerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !menuRef.current) return;
      const items = [burgerRef.current, ...menuRef.current.querySelectorAll<HTMLElement>("a[href]")].filter(Boolean) as HTMLElement[];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    // opening with the keyboard lands on the first link
    const id = window.setTimeout(() => menuRef.current?.querySelector<HTMLElement>("a[href]")?.focus(), 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(id);
    };
  }, [open]);

  return (
    <header
      style={{ viewTransitionName: "site-header" }}
      className="fixed inset-x-0 top-0 z-50 px-4 pt-3.5 sm:px-6"
    >
      <div
        className={`relative mx-auto flex max-w-5xl items-center justify-between gap-3.5 rounded-full border py-2 pl-5 pr-2 backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 ease-out-strong ${
          scrolled || open
            ? "border-line-strong bg-surface/92 shadow-[var(--shadow)]"
            : "border-line bg-[rgba(8,10,18,0.78)]"
        }`}
      >
        <Link
          href="/"
          className="press whitespace-nowrap font-display text-[17px] font-extrabold tracking-tight text-ink no-underline"
        >
          Nicolás<span className="text-accent">.</span>M
        </Link>

        <nav aria-label={navLabel} className="hidden items-center lg:flex">
          <LayoutGroup id="nav">
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <NavLink
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative rounded-full px-3.5 py-2 whitespace-nowrap text-[14px] font-medium no-underline transition-colors duration-200 ${
                    active ? "text-ink" : "text-[var(--ink-nav)] hover:text-ink"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      transition={{ type: "spring", duration: 0.45, bounce: 0.18 }}
                      className="absolute inset-0 -z-0 rounded-full border border-line bg-white/[0.07]"
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </NavLink>
              );
            })}
          </LayoutGroup>
        </nav>

        <div className="flex items-center gap-2.5">
          <LocaleSwitcher />
          <NavLink
            href="/contact"
            className="press hidden rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-accent-ink no-underline hover:bg-accent-hover sm:inline-flex"
          >
            {bookCallLabel}
          </NavLink>
          <button
            type="button"
            aria-label={menuLabel}
            aria-expanded={open}
            aria-controls="mobile-menu"
            ref={burgerRef}
            onClick={() => setOpen((v) => !v)}
            className="press relative flex h-10 w-10 flex-none flex-col items-center justify-center gap-[5px] rounded-full border border-line-strong lg:hidden"
          >
            <span
              className={`block h-[2px] w-4 rounded bg-ink transition-transform duration-300 ease-out-strong ${open ? "translate-y-[7px] rotate-45" : ""}`}
            />
            <span
              className={`block h-[2px] w-4 rounded bg-ink transition-opacity duration-200 ${open ? "opacity-0" : ""}`}
            />
            <span
              className={`block h-[2px] w-4 rounded bg-ink transition-transform duration-300 ease-out-strong ${open ? "-translate-y-[7px] -rotate-45" : ""}`}
            />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="menu"
            id="mobile-menu"
            ref={menuRef}
            initial={{ opacity: 0, clipPath: "inset(0 0 100% 0 round 28px)" }}
            animate={{ opacity: 1, clipPath: "inset(0 0 0% 0 round 28px)" }}
            exit={{ opacity: 0, clipPath: "inset(0 0 100% 0 round 28px)" }}
            transition={{ duration: 0.38, ease: EASE_OUT }}
            className="mx-auto mt-2 max-w-5xl overflow-hidden rounded-[28px] border border-line-strong bg-surface p-3 shadow-[var(--shadow)] backdrop-blur-xl lg:hidden"
          >
            <nav aria-label={navLabel} className="flex flex-col">
              {links.map((link, i) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.06 + i * 0.045, ease: EASE_OUT }}
                  >
                    <NavLink
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center justify-between rounded-2xl px-4 py-3.5 font-display text-[1.5rem] font-extrabold no-underline ${
                        active ? "bg-white/[0.06] text-ink" : "text-ink-soft"
                      }`}
                    >
                      {link.label}
                      <span className="font-mono text-xs text-ink-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </NavLink>
                  </motion.div>
                );
              })}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.06 + links.length * 0.045, ease: EASE_OUT }}
                className="p-1 pt-3"
              >
                <NavLink
                  href="/contact"
                  className="press block rounded-full bg-accent px-5 py-3.5 text-center text-[15px] font-semibold text-accent-ink no-underline"
                >
                  {bookCallLabel}
                </NavLink>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
