type Variant =
  | "dispatch-integration"
  | "support-ticket-system"
  | "revenue-reporting"
  | "agency-automation"
  | "bookkeeply-saas"
  | "jbz-beats-store";

function Node({ x, y, w, label, accent }: { x: number; y: number; w: number; label: string; accent?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height="30" rx="15" fill={accent ? "var(--ink)" : "var(--surface-2)"} stroke={accent ? "none" : "var(--line-strong)"} />
      <text
        x={x + w / 2}
        y={y + 19}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize="10"
        fill={accent ? "var(--bg)" : "var(--ink-soft)"}
      >
        {label}
      </text>
    </g>
  );
}

function DispatchIntegration() {
  return (
    <svg viewBox="0 0 420 110" role="presentation" aria-hidden="true" className="block h-auto w-full">
      <path className="flow-line active" d="M74,25 H166" />
      <path className="flow-line active" d="M254,25 H346" />
      <path className="flow-line" d="M120,55 V70" />
      <Node x={4} y={10} w={70} label="SALES" />
      <Node x={166} y={10} w={88} label="GOHIGHLEVEL" accent />
      <Node x={346} y={10} w={70} label="INVOICE" />
      <Node x={85} y={70} w={70} label="DISPATCH" />
      <Node x={265} y={70} w={70} label="ZAPIER" />
      <path className="flow-line" d="M120,70 V55 H210 V40" />
      <path className="flow-line" d="M300,70 V55 H210 V40" />
    </svg>
  );
}

function SupportTicketSystem() {
  return (
    <svg viewBox="0 0 420 110" role="presentation" aria-hidden="true" className="block h-auto w-full">
      <Node x={4} y={10} w={64} label="PHONE" />
      <Node x={4} y={45} w={64} label="TEXT" />
      <Node x={4} y={80} w={64} label="EMAIL" />
      <path className="flow-line active" d="M68,25 H180 V55" />
      <path className="flow-line active" d="M68,60 H180" />
      <path className="flow-line active" d="M68,95 H180 V60" />
      <Node x={180} y={40} w={90} label="TICKET" accent />
      <path className="flow-line active" d="M270,55 H310" />
      <Node x={310} y={10} w={106} label="ASSIGNED" />
      <Node x={310} y={40} w={106} label="TRACKED" />
      <Node x={310} y={70} w={106} label="CLOSED" />
      <path className="flow-line" d="M300,55 V25 H310" />
      <path className="flow-line" d="M300,55 V85 H310" />
    </svg>
  );
}

function RevenueReporting() {
  const bars = [22, 40, 30, 55, 45, 65, 38];
  return (
    <svg viewBox="0 0 420 110" role="presentation" aria-hidden="true" className="block h-auto w-full">
      <rect x="4" y="4" width="412" height="102" rx="14" fill="var(--surface-2)" stroke="var(--line-strong)" />
      <text x="20" y="24" fontFamily="var(--font-mono)" fontSize="10" fill="var(--ink-faint)">
        REVENUE BY REP
      </text>
      {bars.map((h, i) => (
        <rect
          key={i}
          x={20 + i * 55}
          y={92 - h}
          width="30"
          height={h}
          rx="4"
          fill={i === 5 ? "var(--accent)" : "var(--line-strong)"}
        />
      ))}
    </svg>
  );
}

function AgencyAutomation() {
  return (
    <svg viewBox="0 0 420 110" role="presentation" aria-hidden="true" className="block h-auto w-full">
      <Node x={164} y={40} w={92} label="CRM + EMAIL" accent />
      <path className="flow-line active" d="M164,55 H120 V15" />
      <path className="flow-line active" d="M164,55 H120 V55" />
      <path className="flow-line active" d="M164,55 H120 V95" />
      <path className="flow-line active" d="M256,55 H300 V15" />
      <path className="flow-line active" d="M256,55 H300 V55" />
      <path className="flow-line active" d="M256,55 H300 V95" />
      <Node x={4} y={2} w={90} label="CLIENT A" />
      <Node x={4} y={40} w={90} label="CLIENT B" />
      <Node x={4} y={80} w={90} label="CLIENT C" />
      <Node x={300} y={2} w={116} label="AUTOMATED" />
      <Node x={300} y={40} w={116} label="AUTOMATED" />
      <Node x={300} y={80} w={116} label="AUTOMATED" />
    </svg>
  );
}

function BookkeeplySaas() {
  return (
    <svg viewBox="0 0 420 110" role="presentation" aria-hidden="true" className="block h-auto w-full">
      <Node x={4} y={40} w={90} label="ADD ENTRY" />
      <path className="flow-line active" d="M94,55 H150" />
      <Node x={150} y={40} w={90} label="LEDGER" accent />
      <path className="flow-line active" d="M240,55 V25 H280" />
      <path className="flow-line active" d="M240,55 H280" />
      <path className="flow-line active" d="M240,55 V85 H280" />
      <Node x={280} y={10} w={136} label="DASHBOARD" />
      <Node x={280} y={40} w={136} label="TAX PLANNER" />
      <Node x={280} y={70} w={136} label="RECONCILE" />
    </svg>
  );
}

function JbzBeatsStore() {
  return (
    <svg viewBox="0 0 420 110" role="presentation" aria-hidden="true" className="block h-auto w-full">
      <Node x={4} y={40} w={90} label="CATALOG" />
      <path className="flow-line active" d="M94,55 H150" />
      <Node x={150} y={40} w={90} label="CHECKOUT" accent />
      <path className="flow-line active" d="M240,55 V25 H280" />
      <path className="flow-line active" d="M240,55 H280" />
      <path className="flow-line active" d="M240,55 V85 H280" />
      <Node x={280} y={10} w={136} label="DELIVERY" />
      <Node x={280} y={40} w={136} label="EMAIL" />
      <Node x={280} y={70} w={136} label="ORDER LOG" />
    </svg>
  );
}

const VARIANTS: Record<Variant, () => React.JSX.Element> = {
  "dispatch-integration": DispatchIntegration,
  "support-ticket-system": SupportTicketSystem,
  "revenue-reporting": RevenueReporting,
  "agency-automation": AgencyAutomation,
  "bookkeeply-saas": BookkeeplySaas,
  "jbz-beats-store": JbzBeatsStore,
};

export function CaseStudyDiagram({ variant }: { variant: string }) {
  const Component = VARIANTS[variant as Variant];
  if (!Component) return null;
  return (
    <div className="mb-6 rounded-[var(--radius-md)] border border-line bg-surface p-4">
      <Component />
    </div>
  );
}
