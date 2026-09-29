const TOOLS = [
  "GoHighLevel",
  "Zapier",
  "Kickserv",
  "Airtable",
  "Stripe",
  "Google Sheets",
  "Klaviyo",
  "Google Analytics",
  "Google Tag Manager",
  "Search Console",
  "SEMrush",
  "WordPress",
];

export function ToolsMarquee() {
  const items = [...TOOLS, ...TOOLS];

  return (
    <div className="overflow-hidden border-y border-line py-6">
      <div className="flex w-max gap-3.5 tools-track">
        {items.map((tool, i) => (
          <span
            key={`${tool}-${i}`}
            className="flex-none whitespace-nowrap rounded-full border border-line bg-surface px-4 py-2 font-mono text-[13px] text-ink-soft"
          >
            {tool}
          </span>
        ))}
      </div>
    </div>
  );
}
