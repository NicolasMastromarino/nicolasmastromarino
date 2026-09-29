export function CapCard({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-line bg-surface p-5.5">
      <span className="font-mono text-[11.5px] text-accent-2">{num}</span>
      <h3 className="text-[1.02rem] font-semibold text-ink">{title}</h3>
      <p className="text-[0.92rem] leading-relaxed text-ink-soft">{desc}</p>
    </div>
  );
}
