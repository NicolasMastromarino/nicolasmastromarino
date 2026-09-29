export function ProcessRail({ steps }: { steps: { title: string; desc: string }[] }) {
  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-0">
      {steps.map((step, i) => (
        <div
          key={step.title}
          className="relative border-l-2 border-line-strong pl-5.5 lg:border-l-0 lg:border-t-2 lg:pl-0 lg:pr-4.5 lg:pt-6"
        >
          <span
            className="absolute -left-[7px] top-0 h-[11px] w-[11px] rounded-full bg-accent lg:-left-0 lg:-top-[6.5px]"
            aria-hidden="true"
          />
          <span className="mb-2.5 block font-mono text-xs text-accent">
            {String(i + 1).padStart(2, "0")}
          </span>
          <h3 className="mb-2 text-[1.05rem] font-semibold text-ink">{step.title}</h3>
          <p className="text-[0.92rem] leading-relaxed text-ink-soft">{step.desc}</p>
        </div>
      ))}
    </div>
  );
}
