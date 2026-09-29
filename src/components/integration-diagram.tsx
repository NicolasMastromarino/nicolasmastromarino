const NODES = [
  { label: "GoHighLevel", y: 28 },
  { label: "Kickserv", y: 94 },
  { label: "Airtable", y: 160 },
  { label: "Stripe", y: 226 },
  { label: "Google Sheets", y: 292 },
  { label: "Zapier", y: 358 },
];

type DiagramCopy = {
  title: string;
  ariaLabel: string;
  one: string;
  system: string;
  outcome1: string;
  outcome2: string;
};

export function IntegrationDiagram({ copy }: { copy: DiagramCopy }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4.5 shadow-[var(--shadow)]">
      <svg
        viewBox="0 0 560 420"
        role="img"
        aria-label={copy.ariaLabel}
        className="block h-auto w-full"
      >
        <title>{copy.title}</title>
        <path className="flow-line active" d="M120,44 C190,44 190,180 268,196" />
        <path className="flow-line active" d="M120,110 C190,110 190,186 268,202" />
        <path className="flow-line" d="M120,176 C200,176 210,196 268,208" />
        <path className="flow-line active" d="M120,242 C200,242 210,220 268,214" />
        <path className="flow-line" d="M120,308 C190,308 200,238 268,220" />
        <path className="flow-line active" d="M120,374 C190,374 200,244 268,226" />
        <path className="flow-line active" d="M356,210 C400,210 400,210 444,210" />

        {NODES.map((node) => (
          <g key={node.label}>
            <rect x="6" y={node.y} width="114" height="32" rx="16" fill="var(--surface-2)" stroke="var(--line-strong)" />
            <circle cx="22" cy={node.y + 16} r="3.5" fill="var(--accent-3)" />
            <text x="34" y={node.y + 20} fontFamily="var(--font-mono)" fontSize="11.5" fill="var(--ink-soft)">
              {node.label}
            </text>
          </g>
        ))}

        <g>
          <rect x="268" y="182" width="88" height="56" rx="18" fill="var(--ink)" />
          <text x="312" y="207" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize="12.5" fill="var(--bg)">
            {copy.one}
          </text>
          <text x="312" y="222" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize="12.5" fill="var(--bg)">
            {copy.system}
          </text>
        </g>

        <g>
          <rect x="444" y="188" width="112" height="44" rx="16" fill="var(--accent)" />
          <text x="500" y="207" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="600" fontSize="11.5" fill="var(--accent-ink)">
            {copy.outcome1}
          </text>
          <text x="500" y="221" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="600" fontSize="11.5" fill="var(--accent-ink)">
            {copy.outcome2}
          </text>
        </g>
      </svg>
    </div>
  );
}

export function IntegrationDiagramCompact({ copy }: { copy: DiagramCopy }) {
  const tools = NODES.map((n) => n.label);
  return (
    <div
      role="img"
      aria-label={copy.ariaLabel}
      className="rounded-[var(--radius-lg)] border border-line bg-surface p-5"
    >
      <div className="flex flex-wrap gap-2">
        {tools.map((tool) => (
          <span
            key={tool}
            className="rounded-full border border-line-strong bg-surface-2 px-3 py-1.5 font-mono text-[11px] text-ink-soft"
          >
            {tool}
          </span>
        ))}
      </div>
      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-line-strong" aria-hidden="true" />
        <span className="rounded-full bg-ink px-4 py-2 font-display text-xs font-extrabold text-bg">
          {copy.one} {copy.system}
        </span>
        <span className="h-px flex-1 bg-line-strong" aria-hidden="true" />
      </div>
      <div className="flex justify-center">
        <span className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-ink">
          {copy.outcome1} {copy.outcome2}
        </span>
      </div>
    </div>
  );
}
