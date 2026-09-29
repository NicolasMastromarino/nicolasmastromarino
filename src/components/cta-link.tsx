import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

const STYLES = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  ghost: "bg-transparent text-ink border border-line-strong hover:bg-surface-2",
  dark: "bg-ink text-bg hover:opacity-90",
} as const;

export function CtaLink({
  href,
  variant = "primary",
  children,
  external,
}: {
  href: string;
  variant?: keyof typeof STYLES;
  children: ReactNode;
  external?: boolean;
}) {
  const base =
    "inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14.5px] font-semibold transition-all duration-150 hover:-translate-y-0.5 no-underline";
  const styles = STYLES[variant];

  if (external) {
    return (
      <a href={href} className={`${base} ${styles}`}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={`${base} ${styles}`}>
      {children}
    </Link>
  );
}
