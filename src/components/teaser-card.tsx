import { Link } from "@/i18n/navigation";

export function TeaserCard({
  href,
  label,
  title,
  desc,
  cta,
}: {
  href: string;
  label: string;
  title: string;
  desc: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3.5 rounded-[var(--radius-lg)] border border-line bg-surface p-7 no-underline transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow)]"
    >
      <span className="w-fit rounded-full bg-surface-2 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-accent-2">
        {label}
      </span>
      <h3 className="font-display text-[1.3rem] font-extrabold text-ink">{title}</h3>
      <p className="text-[0.95rem] leading-relaxed text-ink-soft">{desc}</p>
      <span className="mt-auto font-mono text-[12.5px] text-accent">{cta} →</span>
    </Link>
  );
}
