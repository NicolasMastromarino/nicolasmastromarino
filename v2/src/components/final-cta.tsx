import { CtaLink } from "@/components/cta-link";
import { Reveal, RevealWords } from "@/components/motion-primitives";

export function FinalCta({
  title,
  sub,
  cta,
  href = "/contact",
}: {
  title: string;
  sub?: string;
  cta: string;
  href?: string;
}) {
  return (
    // below lg the page is centred; from lg up it sits on the same left edge as every other section (the rail), so the card
    // lines up with the headings above it instead of being inset by its own padding
    <section className="mx-auto max-w-5xl px-5 pb-10 pt-6 sm:px-8 lg:mx-[var(--rail-gutter)] lg:max-w-none lg:px-0">
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-line-strong bg-surface px-7 py-14 sm:px-14 sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(255,91,61,0.35),transparent_65%)] blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-20 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(131,147,255,0.25),transparent_65%)] blur-2xl"
        />
        <div className="relative">
          <RevealWords
            as="h2"
            text={title}
            className="max-w-[18ch] text-[2rem] sm:text-[3.2rem]"
          />
          {sub && (
            <Reveal delay={0.2}>
              <p className="mt-5 max-w-md text-[1rem] leading-relaxed text-ink-soft">{sub}</p>
            </Reveal>
          )}
          <Reveal delay={0.3} className="mt-8">
            <CtaLink href={href}>{cta}</CtaLink>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
