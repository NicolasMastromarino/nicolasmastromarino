"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 font-mono text-xs">
      {routing.locales.map((loc, i) => (
        <span key={loc} className="flex items-center gap-1">
          {i > 0 && <span className="text-ink-faint">/</span>}
          {loc === locale ? (
            <span className="text-ink">{loc.toUpperCase()}</span>
          ) : (
            <Link
              href={pathname}
              locale={loc}
              className="text-ink-faint hover:text-accent-text"
            >
              {loc.toUpperCase()}
            </Link>
          )}
        </span>
      ))}
    </div>
  );
}
