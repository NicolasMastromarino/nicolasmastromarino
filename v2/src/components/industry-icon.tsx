import type { IconName } from "@/components/city/industries";

/** a small drawn mark for what each thing built for a trade does, in one stroke style */
export function Icon({ name }: { name: IconName }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" {...p}>
      {name === "phone" && <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />}
      {name === "route" && (
        <>
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="6" r="2" />
          <path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6" />
        </>
      )}
      {name === "calendar" && (
        <>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </>
      )}
      {name === "star" && <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8Z" />}
      {name === "refresh" && (
        <>
          <path d="M20 11a8 8 0 0 0-14.5-3.5M4 4v4h4" />
          <path d="M4 13a8 8 0 0 0 14.5 3.5M20 20v-4h-4" />
        </>
      )}
      {name === "receipt" && (
        <>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
          <path d="M9 8h6M9 12h6" />
        </>
      )}
      {name === "bell" && <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15ZM10 20a2 2 0 0 0 4 0" />}
      {name === "layers" && <path d="m12 3 9 5-9 5-9-5ZM3 12.5l9 5 9-5M3 16.5l9 5 9-5" />}
      {name === "bolt" && <path d="M13 3 5 13h6l-1 8 8-10h-6Z" />}
      {name === "drop" && <path d="M12 3c3.5 4.5 6 7.5 6 10.5a6 6 0 0 1-12 0C6 10.5 8.5 7.5 12 3Z" />}
    </svg>
  );
}
