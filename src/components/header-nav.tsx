"use client";

import { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";

type NavLink = { href: string; label: string };

export function HeaderNav({
  links,
  bookCallLabel,
}: {
  links: NavLink[];
  bookCallLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 px-4 pt-3.5 sm:px-6">
      <div className="relative mx-auto flex max-w-5xl items-center justify-between gap-3.5 rounded-full border border-line bg-surface/90 px-3 py-2 pl-5 shadow-[var(--shadow)] backdrop-blur-md">
        <Link
          href="/"
          className="whitespace-nowrap font-display text-[17px] font-extrabold tracking-tight text-ink no-underline"
        >
          Nicolás<span className="text-accent">.</span>M
        </Link>

        <nav className="hidden items-center gap-6 text-[14.5px] font-medium text-ink-soft md:flex">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative py-0.5 no-underline transition-colors hover:text-ink ${
                  active ? "text-ink" : ""
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <LocaleSwitcher />
          <Link
            href="/contact"
            className="hidden rounded-full bg-accent px-5 py-2.5 text-[14.5px] font-semibold text-accent-ink no-underline transition-colors hover:bg-accent-hover sm:inline-flex"
          >
            {bookCallLabel}
          </Link>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 flex-none flex-col items-center justify-center gap-[4px] rounded-full border border-line-strong md:hidden"
          >
            <span
              className={`block h-[2px] w-3.5 bg-ink transition-transform ${open ? "translate-y-[6px] rotate-45" : ""}`}
            />
            <span className={`block h-[2px] w-3.5 bg-ink transition-opacity ${open ? "opacity-0" : ""}`} />
            <span
              className={`block h-[2px] w-3.5 bg-ink transition-transform ${open ? "-translate-y-[6px] -rotate-45" : ""}`}
            />
          </button>
        </div>

        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] flex flex-col gap-0.5 rounded-[18px] border border-line bg-surface p-2.5 shadow-[var(--shadow)] md:hidden">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-[10px] px-3.5 py-2.5 text-[15px] font-medium no-underline ${
                    active ? "bg-surface-2 text-ink" : "text-ink-soft"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="mt-1.5 rounded-full bg-accent px-4 py-2.5 text-center text-[14.5px] font-semibold text-accent-ink no-underline"
            >
              {bookCallLabel}
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
