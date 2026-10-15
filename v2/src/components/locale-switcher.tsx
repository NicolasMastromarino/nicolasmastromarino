"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex items-center rounded-full border border-line p-0.5 font-mono text-[11px]">
      {routing.locales.map((loc) =>
        loc === locale ? (
          <span key={loc} className="rounded-full bg-white/[0.1] px-2.5 py-1.5 text-ink">
            {loc.toUpperCase()}
          </span>
        ) : (
          <Link
            key={loc}
            href={pathname}
            locale={loc}
            className="press rounded-full px-2.5 py-1.5 text-ink-faint no-underline hover:text-ink"
          >
            {loc.toUpperCase()}
          </Link>
        ),
      )}
    </div>
  );
}
