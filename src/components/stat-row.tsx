export function StatRow({ stats }: { stats: { value: string; label: string }[] }) {
  return (
    <div className="mt-11 flex flex-wrap gap-x-6 gap-y-4 border-t border-line pt-6">
      {stats.map((stat) => (
        <div key={stat.label} className="whitespace-nowrap">
          <b className="block font-display text-[1.7rem] font-extrabold text-ink">{stat.value}</b>
          <span className="font-mono text-[11.5px] tracking-wide text-ink-faint">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
